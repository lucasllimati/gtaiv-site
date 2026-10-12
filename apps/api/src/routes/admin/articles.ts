import type { FastifyInstance } from 'fastify';
import { and, asc, desc, eq, like, or, sql, type SQL } from 'drizzle-orm';
import {
  adminUsers,
  articleSources,
  articles,
  categories,
  claims,
  sourceItems,
  sources,
  type Db,
} from '@pgi/db';
import {
  APPROVAL_STATUSES,
  articleInputSchema,
  articleTransitionSchema,
  canTransition,
  hasPermission,
  listQuerySchema,
  slugify,
  type ApprovalStatus,
  type ArticleInput,
} from '@pgi/shared';
import { z } from 'zod';
import type { AppContext } from '../../app.ts';
import { badRequest, conflict, forbidden, idParam, notFound, nowIso, parse } from '../../lib/http.ts';
import { requirePermission } from '../../plugins/auth.ts';
import { audit } from '../../services/audit.ts';
import { requestSiteRebuild } from '../../services/dispatch.ts';

async function uniqueSlug(db: Db, base: string, exceptId?: number): Promise<string> {
  const root = slugify(base) || 'artigo';
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? root : `${root}-${i + 1}`;
    const [hit] = await db.select({ id: articles.id }).from(articles).where(eq(articles.slug, candidate));
    if (!hit || hit.id === exceptId) return candidate;
  }
  throw conflict('Não foi possível gerar um slug único.');
}

async function categoryIdFor(db: Db, slug: string): Promise<number> {
  const [cat] = await db.select({ id: categories.id }).from(categories).where(eq(categories.slug, slug));
  if (!cat) throw badRequest(`Categoria inexistente: ${slug}`);
  return cat.id;
}

async function replaceRelations(db: Db, articleId: number, input: ArticleInput): Promise<void> {
  await db.delete(articleSources).where(eq(articleSources.articleId, articleId));
  await db.delete(claims).where(eq(claims.articleId, articleId));
  const seen = new Set<string>();
  const srcs = input.sources.filter((s) => (seen.has(s.url) ? false : (seen.add(s.url), true)));
  if (srcs.length) {
    await db.insert(articleSources).values(
      srcs.map((s) => ({ articleId, url: s.url, title: s.title, publisher: s.publisher, publishedAt: s.publishedAt ?? null, isPrimary: s.isPrimary })),
    );
  }
  if (input.claims.length) {
    await db.insert(claims).values(input.claims.map((c) => ({ articleId, text: c.text, status: c.status, sourceUrl: c.sourceUrl, notes: c.notes ?? null })));
  }
}

export async function loadArticleDetail(db: Db, id: number) {
  const [row] = await db
    .select({ a: articles, categorySlug: categories.slug, categoryName: categories.name })
    .from(articles)
    .innerJoin(categories, eq(categories.id, articles.categoryId))
    .where(eq(articles.id, id));
  if (!row) throw notFound('Artigo');
  const [srcs, cls] = await Promise.all([
    db.select().from(articleSources).where(eq(articleSources.articleId, id)).orderBy(desc(articleSources.isPrimary), asc(articleSources.id)),
    db.select().from(claims).where(eq(claims.articleId, id)).orderBy(asc(claims.id)),
  ]);
  let sourceItem = null;
  if (row.a.sourceItemId) {
    const [si] = await db
      .select({ item: sourceItems, sourceName: sources.name, sourceType: sources.type })
      .from(sourceItems)
      .innerJoin(sources, eq(sources.id, sourceItems.sourceId))
      .where(eq(sourceItems.id, row.a.sourceItemId));
    sourceItem = si ?? null;
  }
  let approvedByName: string | null = null;
  if (row.a.approvedBy) {
    const [u] = await db.select({ name: adminUsers.name }).from(adminUsers).where(eq(adminUsers.id, row.a.approvedBy));
    approvedByName = u?.name ?? null;
  }
  return { ...row.a, category: { slug: row.categorySlug, name: row.categoryName }, sources: srcs, claims: cls, sourceItem, approvedByName };
}

export async function articleRoutes(app: FastifyInstance, ctx: AppContext): Promise<void> {
  const { db, config } = ctx;

  app.get('/categories', async () => db.select().from(categories).orderBy(asc(categories.sortOrder)));

  app.get('/articles', { preHandler: requirePermission('articles:read') }, async (req) => {
    const q = parse(listQuerySchema, req.query);
    const conds: SQL[] = [];
    if (q.status) {
      if (!(APPROVAL_STATUSES as readonly string[]).includes(q.status)) throw badRequest('Status inválido.');
      conds.push(eq(articles.approvalStatus, q.status as ApprovalStatus));
    }
    if (q.q) {
      const pat = `%${q.q.replace(/[%_]/g, '')}%`;
      conds.push(or(like(articles.title, pat), like(articles.summary, pat))!);
    }
    const where = conds.length ? and(...conds) : undefined;
    const [rows, [count]] = await Promise.all([
      db
        .select({
          id: articles.id,
          slug: articles.slug,
          title: articles.title,
          approvalStatus: articles.approvalStatus,
          verificationStatus: articles.verificationStatus,
          category: categories.name,
          featured: articles.featured,
          aiAssisted: articles.aiAssisted,
          updatedAt: articles.updatedAt,
          publishedAt: articles.publishedAt,
        })
        .from(articles)
        .innerJoin(categories, eq(categories.id, articles.categoryId))
        .where(where)
        .orderBy(desc(articles.updatedAt))
        .limit(q.pageSize)
        .offset((q.page - 1) * q.pageSize),
      db.select({ n: sql<number>`count(*)` }).from(articles).where(where),
    ]);
    return { items: rows, total: Number(count?.n ?? 0), page: q.page, pageSize: q.pageSize };
  });

  app.get('/articles/:id', { preHandler: requirePermission('articles:read') }, async (req) => loadArticleDetail(db, idParam(req.params)));

  app.post('/articles', { preHandler: requirePermission('articles:write') }, async (req, reply) => {
    const input = parse(articleInputSchema, req.body);
    const slug = await uniqueSlug(db, input.slug ?? input.title);
    const [row] = await db
      .insert(articles)
      .values({
        slug,
        title: input.title,
        summary: input.summary,
        body: input.body,
        categoryId: await categoryIdFor(db, input.categorySlug),
        verificationStatus: input.verificationStatus,
        approvalStatus: 'draft',
        authorName: input.authorName,
        coverAssetId: input.coverAssetId ?? null,
        coverAlt: input.coverAlt ?? null,
        featured: input.featured,
        tags: input.tags,
        createdBy: req.user!.id,
        updatedBy: req.user!.id,
      })
      .returning({ id: articles.id });
    await replaceRelations(db, row!.id, input);
    await audit(db, req.user, 'article.create', 'article', row!.id, { title: input.title });
    return reply.status(201).send(await loadArticleDetail(db, row!.id));
  });

  app.put('/articles/:id', { preHandler: requirePermission('articles:write') }, async (req) => {
    const id = idParam(req.params);
    const input = parse(articleInputSchema, req.body);
    const current = await loadArticleDetail(db, id);
    const live = current.approvalStatus === 'published' || current.approvalStatus === 'approved';
    if (live && !hasPermission(req.user!.role, 'articles:publish')) {
      throw forbidden('Somente administradores podem editar artigos aprovados ou publicados.');
    }
    const slug = input.slug && input.slug !== current.slug ? await uniqueSlug(db, input.slug, id) : current.slug;
    // Edições substanciais em artigo aprovado (não publicado) exigem nova aprovação.
    const nextStatus: ApprovalStatus = current.approvalStatus === 'approved' ? 'in_review' : current.approvalStatus;
    await db
      .update(articles)
      .set({
        slug,
        title: input.title,
        summary: input.summary,
        body: input.body,
        categoryId: await categoryIdFor(db, input.categorySlug),
        verificationStatus: input.verificationStatus,
        authorName: input.authorName,
        coverAssetId: input.coverAssetId ?? null,
        coverAlt: input.coverAlt ?? null,
        featured: input.featured,
        tags: input.tags,
        approvalStatus: nextStatus,
        ...(nextStatus === 'in_review' ? { approvedBy: null, approvedAt: null } : {}),
        updatedBy: req.user!.id,
        updatedAt: nowIso(),
      })
      .where(eq(articles.id, id));
    await replaceRelations(db, id, input);
    await audit(db, req.user, 'article.update', 'article', id, { title: input.title, status: nextStatus });
    if (current.approvalStatus === 'published') void requestSiteRebuild(config, `article ${id} updated`);
    return loadArticleDetail(db, id);
  });

  app.post('/articles/:id/transition', { preHandler: requirePermission('articles:write') }, async (req) => {
    const id = idParam(req.params);
    const { to, note } = parse(articleTransitionSchema, req.body);
    const current = await loadArticleDetail(db, id);
    const from = current.approvalStatus;
    if (!canTransition(from, to)) throw badRequest(`Transição não permitida: ${from} → ${to}.`);

    const role = req.user!.role;
    if ((to === 'approved' || to === 'rejected') && !hasPermission(role, 'articles:approve')) throw forbidden();
    if ((to === 'published' || from === 'published') && !hasPermission(role, 'articles:publish')) {
      throw forbidden('Somente administradores podem publicar ou despublicar.');
    }
    if (to === 'approved') {
      if (current.sources.length === 0) throw badRequest('Inclua ao menos uma fonte antes de aprovar.');
      if (current.body.includes('Rascunho automático sem IA')) {
        throw badRequest('O texto ainda contém o aviso de rascunho automático. Reescreva antes de aprovar.');
      }
    }
    if (to === 'published' && !current.approvedBy) throw badRequest('O artigo precisa de aprovação humana antes da publicação.');

    const patch: Partial<typeof articles.$inferInsert> = { approvalStatus: to, updatedAt: nowIso(), updatedBy: req.user!.id, reviewNote: note ?? current.reviewNote };
    if (to === 'approved') Object.assign(patch, { approvedBy: req.user!.id, approvedAt: nowIso() });
    if (to === 'draft' || to === 'rejected') Object.assign(patch, { approvedBy: null, approvedAt: null });
    if (to === 'published') patch.publishedAt = current.publishedAt ?? nowIso();
    await db.update(articles).set(patch).where(eq(articles.id, id));
    await audit(db, req.user, `article.${to}`, 'article', id, { from, to, note });
    if (to === 'published' || from === 'published') void requestSiteRebuild(config, `article ${id} ${to}`);
    return loadArticleDetail(db, id);
  });

  app.delete('/articles/:id', { preHandler: requirePermission('articles:publish') }, async (req, reply) => {
    const id = idParam(req.params);
    const current = await loadArticleDetail(db, id);
    if (current.approvalStatus === 'published') throw badRequest('Arquive o artigo antes de excluí-lo.');
    await db.update(sourceItems).set({ articleId: null, status: 'new' }).where(eq(sourceItems.articleId, id));
    await db.delete(articles).where(eq(articles.id, id));
    await audit(db, req.user, 'article.delete', 'article', id, { title: current.title });
    return reply.status(204).send();
  });

  app.put('/categories/:id', { preHandler: requirePermission('sources:write') }, async (req) => {
    const id = idParam(req.params);
    const body = parse(z.object({ name: z.string().trim().min(2).max(60), description: z.string().trim().max(300), sortOrder: z.number().int().min(0).max(1000) }), req.body);
    await db.update(categories).set({ ...body, updatedAt: nowIso() }).where(eq(categories.id, id));
    await audit(db, req.user, 'category.update', 'category', id, body);
    return { ok: true };
  });
}
