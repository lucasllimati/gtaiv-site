import type { FastifyInstance } from 'fastify';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { articleSources, articles, categories, claims, pipelineLogs, pipelineRuns, sourceItems, sources } from '@pgi/db';
import { SOURCE_ITEM_STATUSES, listQuerySchema, slugify, sourceInputSchema, truncate, type SourceItemStatus } from '@pgi/shared';
import { z } from 'zod';
import type { AppContext } from '../../app.ts';
import { HttpError, badRequest, conflict, idParam, notFound, nowIso, parse } from '../../lib/http.ts';
import { requirePermission } from '../../plugins/auth.ts';
import { audit } from '../../services/audit.ts';

export async function sourceRoutes(app: FastifyInstance, ctx: AppContext): Promise<void> {
  const { db, ai } = ctx;

  // ---- Fontes ----
  app.get('/sources', { preHandler: requirePermission('articles:read') }, async () => {
    const rows = await db.select().from(sources).orderBy(desc(sources.reliability), sources.name);
    const counts = await db
      .select({ sourceId: sourceItems.sourceId, n: sql<number>`count(*)` })
      .from(sourceItems)
      .groupBy(sourceItems.sourceId);
    const by = new Map(counts.map((c) => [c.sourceId, Number(c.n)]));
    return rows.map((s) => ({ ...s, itemCount: by.get(s.id) ?? 0 }));
  });

  app.post('/sources', { preHandler: requirePermission('sources:write') }, async (req, reply) => {
    const input = parse(sourceInputSchema, req.body);
    if (input.method === 'rss' && !input.feedUrl) throw badRequest('Fontes do tipo RSS precisam da URL do feed.');
    const [row] = await db.insert(sources).values({ ...input, notes: input.notes ?? null }).returning();
    await audit(db, req.user, 'source.create', 'source', row!.id, { name: input.name });
    return reply.status(201).send(row);
  });

  app.put('/sources/:id', { preHandler: requirePermission('sources:write') }, async (req) => {
    const id = idParam(req.params);
    const input = parse(sourceInputSchema, req.body);
    if (input.method === 'rss' && !input.feedUrl) throw badRequest('Fontes do tipo RSS precisam da URL do feed.');
    const [row] = await db.update(sources).set({ ...input, notes: input.notes ?? null, updatedAt: nowIso() }).where(eq(sources.id, id)).returning();
    if (!row) throw notFound('Fonte');
    await audit(db, req.user, 'source.update', 'source', id, { name: input.name, enabled: input.enabled });
    return row;
  });

  app.delete('/sources/:id', { preHandler: requirePermission('sources:write') }, async (req, reply) => {
    const id = idParam(req.params);
    const [used] = await db.select({ n: sql<number>`count(*)` }).from(sourceItems).where(eq(sourceItems.sourceId, id));
    if (Number(used?.n ?? 0) > 0) throw conflict('A fonte já possui itens coletados. Desative-a em vez de excluir.');
    await db.delete(sources).where(eq(sources.id, id));
    await audit(db, req.user, 'source.delete', 'source', id);
    return reply.status(204).send();
  });

  // ---- Fila de itens coletados ----
  app.get('/source-items', { preHandler: requirePermission('articles:read') }, async (req) => {
    const q = parse(listQuerySchema, req.query);
    const status = (q.status ?? 'new') as SourceItemStatus;
    if (!(SOURCE_ITEM_STATUSES as readonly string[]).includes(status)) throw badRequest('Status inválido.');
    const where = eq(sourceItems.status, status);
    const [rows, [count]] = await Promise.all([
      db
        .select({ item: sourceItems, sourceName: sources.name, sourceType: sources.type, reliability: sources.reliability })
        .from(sourceItems)
        .innerJoin(sources, eq(sources.id, sourceItems.sourceId))
        .where(where)
        .orderBy(desc(sourceItems.publishedAt), desc(sourceItems.collectedAt))
        .limit(q.pageSize)
        .offset((q.page - 1) * q.pageSize),
      db.select({ n: sql<number>`count(*)` }).from(sourceItems).where(where),
    ]);
    const dupIds = rows.map((r) => r.item.duplicateOfId).filter((x): x is number => x != null);
    const dups = dupIds.length
      ? await db.select({ id: sourceItems.id, title: sourceItems.title, url: sourceItems.url }).from(sourceItems).where(inArray(sourceItems.id, dupIds))
      : [];
    const dupBy = new Map(dups.map((d) => [d.id, d]));
    return {
      items: rows.map((r) => ({ ...r.item, sourceName: r.sourceName, sourceType: r.sourceType, reliability: r.reliability, duplicateOf: r.item.duplicateOfId ? dupBy.get(r.item.duplicateOfId) ?? null : null })),
      total: Number(count?.n ?? 0),
      page: q.page,
      pageSize: q.pageSize,
    };
  });

  app.post('/source-items/:id/status', { preHandler: requirePermission('articles:write') }, async (req) => {
    const id = idParam(req.params);
    const { status } = parse(z.object({ status: z.enum(['new', 'ignored']) }), req.body);
    const [row] = await db.update(sourceItems).set({ status, updatedAt: nowIso() }).where(eq(sourceItems.id, id)).returning({ id: sourceItems.id });
    if (!row) throw notFound('Item');
    await audit(db, req.user, `source_item.${status}`, 'source_item', id);
    return { ok: true };
  });

  /** Gera um rascunho (IA ou modelo) a partir de um item coletado. O rascunho vai para revisão humana. */
  app.post(
    '/source-items/:id/draft',
    { preHandler: requirePermission('articles:write'), config: { rateLimit: { max: 20, timeWindow: '1 minute' } } },
    async (req, reply) => {
      const id = idParam(req.params);
      const [row] = await db
        .select({ item: sourceItems, source: sources })
        .from(sourceItems)
        .innerJoin(sources, eq(sources.id, sourceItems.sourceId))
        .where(eq(sourceItems.id, id));
      if (!row) throw notFound('Item');
      if (row.item.articleId) throw conflict('Este item já possui um rascunho.');

      const draft = await ai.draftFromSourceItem({
        title: row.item.title,
        excerpt: row.item.excerpt,
        url: row.item.url,
        sourceName: row.source.name,
        sourceType: row.source.type,
        publishedAt: row.item.publishedAt,
        suggestedStatus: row.item.suggestedStatus,
      });
      const categorySlug = row.source.type === 'official' ? 'oficial' : draft.verificationStatus === 'rumor' || draft.verificationStatus === 'theory' ? 'rumores' : 'noticias';
      const [cat] = await db.select({ id: categories.id }).from(categories).where(eq(categories.slug, categorySlug));
      if (!cat) throw new HttpError(500, 'Categoria padrão ausente. Rode o seed.');

      const base = slugify(draft.title) || `rascunho-${id}`;
      let slug = base;
      for (let i = 2; (await db.select({ id: articles.id }).from(articles).where(eq(articles.slug, slug))).length; i++) slug = `${base}-${i}`;

      const [art] = await db
        .insert(articles)
        .values({
          slug,
          title: truncate(draft.title, 160),
          summary: truncate(draft.summary, 400),
          body: draft.body,
          categoryId: cat.id,
          verificationStatus: draft.verificationStatus,
          approvalStatus: 'draft',
          authorName: req.user!.name,
          tags: draft.tags.slice(0, 12),
          aiAssisted: draft.generator === 'ai',
          sourceItemId: id,
          reviewNote: draft.reviewerNotes,
          createdBy: req.user!.id,
          updatedBy: req.user!.id,
        })
        .returning({ id: articles.id });
      await db.insert(articleSources).values({
        articleId: art!.id,
        sourceId: row.source.id,
        url: row.item.url,
        title: row.item.title,
        publisher: row.source.name,
        publishedAt: row.item.publishedAt,
        isPrimary: true,
      });
      const cl = draft.claims.slice(0, 50).filter((c) => c.text.trim().length >= 3);
      if (cl.length) {
        await db.insert(claims).values(cl.map((c) => ({ articleId: art!.id, text: truncate(c.text, 600), status: c.status, sourceUrl: c.sourceUrl && /^https?:\/\//.test(c.sourceUrl) ? c.sourceUrl : null })));
      }
      await db.update(sourceItems).set({ status: 'drafted', articleId: art!.id, updatedAt: nowIso() }).where(eq(sourceItems.id, id));
      await audit(db, req.user, 'article.draft_from_source', 'article', art!.id, { sourceItemId: id, generator: draft.generator });
      return reply.status(201).send({ articleId: art!.id, generator: draft.generator });
    },
  );

  // ---- Pipeline ----
  app.get('/pipeline/runs', { preHandler: requirePermission('articles:read') }, async () =>
    db.select().from(pipelineRuns).orderBy(desc(pipelineRuns.startedAt)).limit(50),
  );

  app.get('/pipeline/runs/:id', { preHandler: requirePermission('articles:read') }, async (req) => {
    const id = idParam(req.params);
    const [run] = await db.select().from(pipelineRuns).where(eq(pipelineRuns.id, id));
    if (!run) throw notFound('Execução');
    const logs = await db
      .select({ log: pipelineLogs, sourceName: sources.name })
      .from(pipelineLogs)
      .leftJoin(sources, eq(sources.id, pipelineLogs.sourceId))
      .where(eq(pipelineLogs.runId, id))
      .orderBy(pipelineLogs.id);
    return { run, logs: logs.map((l) => ({ ...l.log, sourceName: l.sourceName })) };
  });

  app.post(
    '/pipeline/run',
    { preHandler: requirePermission('pipeline:run'), config: { rateLimit: { max: 4, timeWindow: '5 minutes' } } },
    async (req) => {
      const { sourceId } = parse(z.object({ sourceId: z.number().int().positive().optional() }), req.body ?? {});
      if (!ctx.runCollect) throw new HttpError(503, 'A coleta não está disponível neste servidor.');
      const [running] = await db.select({ id: pipelineRuns.id }).from(pipelineRuns).where(and(eq(pipelineRuns.status, 'running'), sql`${pipelineRuns.startedAt} > ${new Date(Date.now() - 15 * 60_000).toISOString()}`));
      if (running) throw conflict('Já existe uma coleta em andamento.');
      const result = await ctx.runCollect(`manual:${req.user!.email}`, sourceId);
      await audit(db, req.user, 'pipeline.run', 'pipeline_run', result.runId, { sourceId });
      return result;
    },
  );
}
