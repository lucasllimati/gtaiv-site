import { and, asc, desc, eq, inArray, lte, isNull, or, gte } from 'drizzle-orm';
import {
  isPriceFresh,
  readingTimeMinutes,
  type PublicArticle,
  type PublicArticleSummary,
  type PublicBanner,
  type PublicFacts,
  type PublicSettings,
  type PublicSiteData,
} from '@pgi/shared';
import type { Db } from './client.ts';
import {
  affiliateLinks,
  articleSources,
  articles,
  banners,
  categories,
  channels,
  claims,
  contentAssets,
  discoveries,
  facts,
  guideEntries,
  products,
  settings,
} from './schema.ts';

/** Converte a chave de armazenamento de um ativo em URL pública. */
export type AssetUrlResolver = (storageKey: string) => string;

export const DEFAULT_SETTINGS: PublicSettings = {
  siteName: 'Project GTA IV',
  tagline: 'Notícias verificadas, guias e descobertas sobre GTA VI',
  contactEmail: '',
};

export async function loadSettings(db: Db): Promise<PublicSettings> {
  const rows = await db.select().from(settings);
  const out: PublicSettings = { ...DEFAULT_SETTINGS };
  for (const r of rows) {
    if (r.key in out && typeof r.value === 'string') (out as unknown as Record<string, string>)[r.key] = r.value;
  }
  return out;
}

async function loadFacts(db: Db): Promise<PublicFacts> {
  const rows = await db.select().from(facts);
  const byKey = new Map(rows.map((r) => [r.key, { value: r.value, status: r.status, sourceUrl: r.sourceUrl }]));
  return {
    releaseDate: byKey.get('releaseDate') ?? null,
    platforms: byKey.get('platforms') ?? null,
    developer: byKey.get('developer') ?? null,
    setting: byKey.get('setting') ?? null,
  };
}

const publishedArticle = eq(articles.approvalStatus, 'published');

export async function listPublicArticles(db: Db, resolve: AssetUrlResolver): Promise<PublicArticleSummary[]> {
  const rows = await db
    .select({
      a: articles,
      categorySlug: categories.slug,
      categoryName: categories.name,
      coverKey: contentAssets.storageKey,
    })
    .from(articles)
    .innerJoin(categories, eq(categories.id, articles.categoryId))
    .leftJoin(contentAssets, eq(contentAssets.id, articles.coverAssetId))
    .where(publishedArticle)
    .orderBy(desc(articles.publishedAt));

  const ids = rows.map((r) => r.a.id);
  const primaries = ids.length
    ? await db
        .select({ articleId: articleSources.articleId, publisher: articleSources.publisher, url: articleSources.url, isPrimary: articleSources.isPrimary })
        .from(articleSources)
        .where(inArray(articleSources.articleId, ids))
    : [];
  const primaryBy = new Map<number, { publisher: string; url: string }>();
  for (const s of primaries) {
    if (s.isPrimary || !primaryBy.has(s.articleId)) primaryBy.set(s.articleId, { publisher: s.publisher, url: s.url });
  }

  return rows.map(({ a, categorySlug, categoryName, coverKey }) => ({
    slug: a.slug,
    title: a.title,
    summary: a.summary,
    category: { slug: categorySlug, name: categoryName },
    verificationStatus: a.verificationStatus,
    publishedAt: a.publishedAt ?? a.updatedAt,
    updatedAt: a.updatedAt,
    authorName: a.authorName,
    coverUrl: coverKey ? resolve(coverKey) : null,
    coverAlt: a.coverAlt,
    featured: a.featured,
    tags: a.tags,
    readingMinutes: readingTimeMinutes(a.body),
    primarySource: primaryBy.get(a.id) ?? null,
  }));
}

export async function getPublicArticle(db: Db, slug: string, resolve: AssetUrlResolver): Promise<PublicArticle | null> {
  const [row] = await db
    .select({ a: articles, categorySlug: categories.slug, categoryName: categories.name, coverKey: contentAssets.storageKey })
    .from(articles)
    .innerJoin(categories, eq(categories.id, articles.categoryId))
    .leftJoin(contentAssets, eq(contentAssets.id, articles.coverAssetId))
    .where(and(publishedArticle, eq(articles.slug, slug)));
  if (!row) return null;
  const { a } = row;
  const srcs = await db.select().from(articleSources).where(eq(articleSources.articleId, a.id)).orderBy(desc(articleSources.isPrimary), asc(articleSources.id));
  const cls = await db.select().from(claims).where(eq(claims.articleId, a.id)).orderBy(asc(claims.id));
  const primary = srcs.find((s) => s.isPrimary) ?? srcs[0];
  return {
    slug: a.slug,
    title: a.title,
    summary: a.summary,
    body: a.body,
    category: { slug: row.categorySlug, name: row.categoryName },
    verificationStatus: a.verificationStatus,
    publishedAt: a.publishedAt ?? a.updatedAt,
    updatedAt: a.updatedAt,
    authorName: a.authorName,
    coverUrl: row.coverKey ? resolve(row.coverKey) : null,
    coverAlt: a.coverAlt,
    featured: a.featured,
    tags: a.tags,
    readingMinutes: readingTimeMinutes(a.body),
    primarySource: primary ? { publisher: primary.publisher, url: primary.url } : null,
    sources: srcs.map((s) => ({ url: s.url, title: s.title, publisher: s.publisher, publishedAt: s.publishedAt, isPrimary: s.isPrimary })),
    claims: cls.map((c) => ({ text: c.text, status: c.status, sourceUrl: c.sourceUrl })),
    approvedAt: a.approvedAt,
    aiAssisted: a.aiAssisted,
  };
}

/**
 * Banners ativos no período de exibição. Para cada posição, retorna o de maior prioridade.
 */
export async function activeBanners(db: Db, at = new Date()): Promise<PublicBanner[]> {
  const iso = at.toISOString();
  const rows = await db
    .select()
    .from(banners)
    .where(
      and(
        eq(banners.status, 'active'),
        or(isNull(banners.startsAt), lte(banners.startsAt, iso)),
        or(isNull(banners.endsAt), gte(banners.endsAt, iso)),
      ),
    )
    .orderBy(desc(banners.priority), desc(banners.updatedAt));
  const bySlot = new Map<string, PublicBanner>();
  for (const b of rows) {
    if (bySlot.has(b.slot)) continue;
    bySlot.set(b.slot, {
      id: b.id,
      slot: b.slot,
      title: b.title,
      subtitle: b.subtitle,
      description: b.description,
      imageUrl: b.imageUrl,
      ctaLabel: b.ctaLabel,
      store: b.store,
      url: b.targetUrl,
    });
  }
  return [...bySlot.values()];
}

export async function buildPublicSiteData(
  db: Db,
  opts: { origin: 'api' | 'snapshot'; resolve: AssetUrlResolver; now?: Date },
): Promise<PublicSiteData> {
  const now = opts.now ?? new Date();
  const [settingsRow, factRows, cats, arts, guide, disc, prodRows, bannerRows, chans] = await Promise.all([
    loadSettings(db),
    loadFacts(db),
    db.select().from(categories).orderBy(asc(categories.sortOrder)),
    listPublicArticles(db, opts.resolve),
    db.select().from(guideEntries).where(eq(guideEntries.published, true)).orderBy(asc(guideEntries.kind), asc(guideEntries.sortOrder)),
    db.select().from(discoveries).where(eq(discoveries.published, true)).orderBy(desc(discoveries.updatedAt)),
    db
      .select({ p: products, link: affiliateLinks })
      .from(products)
      .innerJoin(affiliateLinks, and(eq(affiliateLinks.productId, products.id), eq(affiliateLinks.active, true)))
      .where(eq(products.active, true))
      .orderBy(asc(products.sortOrder), asc(products.id)),
    activeBanners(db, now),
    db.select().from(channels).where(eq(channels.active, true)).orderBy(asc(channels.kind)),
  ]);

  const seenProducts = new Set<number>();
  const productList = prodRows
    .filter(({ p }) => (seenProducts.has(p.id) ? false : (seenProducts.add(p.id), true)))
    .map(({ p, link }) => {
      // Preço só é exibido quando foi verificado dentro da janela de validade.
      const fresh = p.priceCents != null && isPriceFresh(p.priceCheckedAt, now);
      return {
        id: p.id,
        name: p.name,
        category: p.category,
        description: p.description,
        imageUrl: p.imageUrl,
        store: link.store,
        url: link.url,
        priceCents: fresh ? p.priceCents : null,
        currency: p.currency,
        priceCheckedAt: fresh ? p.priceCheckedAt : null,
        availability: p.availability,
      };
    });

  return {
    generatedAt: now.toISOString(),
    origin: opts.origin,
    settings: settingsRow,
    facts: factRows,
    categories: cats.map((c) => ({ slug: c.slug, name: c.name, description: c.description })),
    articles: arts,
    guide: guide.map((g) => ({
      kind: g.kind,
      slug: g.slug,
      title: g.title,
      summary: g.summary,
      body: g.body,
      verificationStatus: g.verificationStatus,
      eventDate: g.eventDate,
      sources: g.sources,
      updatedAt: g.updatedAt,
    })),
    discoveries: disc.map((d) => ({
      slug: d.slug,
      title: d.title,
      kind: d.kind,
      description: d.description,
      gameVersion: d.gameVersion,
      platforms: d.platforms,
      steps: d.steps,
      evidence: d.evidence,
      sourceUrl: d.sourceUrl,
      verificationStatus: d.verificationStatus,
      lastConfirmedAt: d.lastConfirmedAt,
      riskWarning: d.riskWarning,
      fixedInVersion: d.fixedInVersion,
      updatedAt: d.updatedAt,
    })),
    products: productList,
    banners: bannerRows,
    channels: chans.map((c) => ({ id: c.id, kind: c.kind, label: c.label, url: c.url, description: c.description })),
  };
}
