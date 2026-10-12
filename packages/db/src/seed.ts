import { eq } from 'drizzle-orm';
import { pathToFileURL } from 'node:url';
import { createDb, migrateDb, type Db } from './client.ts';
import {
  articleSources,
  articles,
  categories,
  claims,
  facts,
  guideEntries,
  settings,
  sources,
} from './schema.ts';
import {
  SEED_AUTHOR,
  SEED_DATE,
  seedArticles,
  seedCategories,
  seedFacts,
  seedGuide,
  seedSettings,
  seedSources,
} from './seed-content.ts';

/**
 * Seed idempotente: só insere o que ainda não existe. Nunca sobrescreve
 * edições feitas pelo painel.
 */
export async function seed(db: Db): Promise<{ inserted: Record<string, number> }> {
  const inserted: Record<string, number> = {};
  const bump = (k: string) => (inserted[k] = (inserted[k] ?? 0) + 1);

  for (const c of seedCategories) {
    const r = await db.insert(categories).values(c).onConflictDoNothing().returning({ id: categories.id });
    if (r.length) bump('categories');
  }
  const catRows = await db.select().from(categories);
  const catId = new Map(catRows.map((c) => [c.slug, c.id]));

  for (const [key, value] of Object.entries(seedSettings)) {
    const r = await db.insert(settings).values({ key, value }).onConflictDoNothing().returning({ key: settings.key });
    if (r.length) bump('settings');
  }

  for (const f of seedFacts) {
    const r = await db.insert(facts).values(f).onConflictDoNothing().returning({ key: facts.key });
    if (r.length) bump('facts');
  }

  const existingSources = new Set((await db.select({ name: sources.name }).from(sources)).map((s) => s.name));
  for (const s of seedSources) {
    if (existingSources.has(s.name)) continue;
    await db.insert(sources).values(s);
    bump('sources');
  }

  for (const a of seedArticles) {
    const exists = await db.select({ id: articles.id }).from(articles).where(eq(articles.slug, a.slug));
    if (exists.length) continue;
    const categoryId = catId.get(a.category);
    if (!categoryId) throw new Error(`Categoria inexistente: ${a.category}`);
    const [row] = await db
      .insert(articles)
      .values({
        slug: a.slug,
        title: a.title,
        summary: a.summary,
        body: a.body,
        categoryId,
        verificationStatus: a.verificationStatus,
        approvalStatus: 'published',
        authorName: SEED_AUTHOR,
        featured: a.featured,
        tags: a.tags,
        aiAssisted: true,
        reviewNote:
          'Conteúdo-base criado junto com o projeto, com fontes oficiais citadas. Recomenda-se revisão pelo editor responsável.',
        approvedAt: SEED_DATE,
        publishedAt: SEED_DATE,
        createdAt: SEED_DATE,
        updatedAt: SEED_DATE,
      })
      .returning({ id: articles.id });
    if (!row) throw new Error('Falha ao inserir artigo');
    if (a.sources.length) {
      await db.insert(articleSources).values(a.sources.map((s) => ({ ...s, articleId: row.id, accessedAt: SEED_DATE })));
    }
    if (a.claims.length) {
      await db.insert(claims).values(a.claims.map((c) => ({ ...c, articleId: row.id })));
    }
    bump('articles');
  }

  for (const g of seedGuide) {
    const r = await db
      .insert(guideEntries)
      .values({
        kind: g.kind,
        slug: g.slug,
        title: g.title,
        summary: g.summary,
        body: g.body ?? '',
        verificationStatus: g.verificationStatus,
        eventDate: g.eventDate ?? null,
        sortOrder: g.sortOrder,
        sources: g.sources,
        published: true,
        createdAt: SEED_DATE,
        updatedAt: SEED_DATE,
      })
      .onConflictDoNothing()
      .returning({ id: guideEntries.id });
    if (r.length) bump('guide');
  }

  return { inserted };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const { db, client } = createDb();
  await migrateDb(db);
  const { inserted } = await seed(db);
  console.log('Seed concluído:', Object.keys(inserted).length ? inserted : 'nada novo para inserir');
  client.close();
}
