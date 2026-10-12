import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
  type AnySQLiteColumn,
} from 'drizzle-orm/sqlite-core';
import type {
  ApprovalStatus,
  Availability,
  BannerSlot,
  BannerStatus,
  ChannelKind,
  DiscoveryKind,
  GuideKind,
  ProductCategory,
  Role,
  SourceItemStatus,
  SourceMethod,
  SourceType,
  VerificationStatus,
} from '@pgi/shared';

/**
 * Datas são gravadas como texto ISO-8601 (UTC). Isso mantém o schema portátil
 * entre SQLite local e libSQL/Turso, e legível em backups.
 */
const now = sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`;
const createdAt = () => text('created_at').notNull().default(now);
const updatedAt = () => text('updated_at').notNull().default(now);

export const adminUsers = sqliteTable('admin_users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  passwordHash: text('password_hash').notNull(),
  role: text('role').$type<Role>().notNull(),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  failedLogins: integer('failed_logins').notNull().default(0),
  lockedUntil: text('locked_until'),
  lastLoginAt: text('last_login_at'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const sessions = sqliteTable(
  'sessions',
  {
    /** SHA-256 do token. O token em si só existe no cookie do navegador. */
    tokenHash: text('token_hash').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => adminUsers.id, { onDelete: 'cascade' }),
    csrfToken: text('csrf_token').notNull(),
    createdAt: createdAt(),
    expiresAt: text('expires_at').notNull(),
    userAgent: text('user_agent'),
  },
  (t) => [index('sessions_user_idx').on(t.userId), index('sessions_expires_idx').on(t.expiresAt)],
);

export const categories = sqliteTable('categories', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const sources = sqliteTable('sources', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  siteUrl: text('site_url').notNull(),
  feedUrl: text('feed_url'),
  type: text('type').$type<SourceType>().notNull(),
  method: text('method').$type<SourceMethod>().notNull(),
  /** 1 (baixa) a 5 (oficial). Usado para ordenar e para sugerir o status de verificação. */
  reliability: integer('reliability').notNull(),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  /** JSON: palavras-chave exigidas para aceitar um item de feed genérico. */
  keywords: text('keywords', { mode: 'json' }).$type<string[]>().notNull().default(sql`'[]'`),
  lastRunAt: text('last_run_at'),
  lastSuccessAt: text('last_success_at'),
  lastStatus: text('last_status').$type<'ok' | 'error' | 'skipped' | 'never'>().notNull().default('never'),
  lastError: text('last_error'),
  consecutiveFailures: integer('consecutive_failures').notNull().default(0),
  etag: text('etag'),
  lastModified: text('last_modified'),
  notes: text('notes'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const sourceItems = sqliteTable(
  'source_items',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    sourceId: integer('source_id')
      .notNull()
      .references(() => sources.id, { onDelete: 'cascade' }),
    guid: text('guid'),
    url: text('url').notNull(),
    canonicalUrl: text('canonical_url').notNull(),
    title: text('title').notNull(),
    /** Apenas o resumo/trecho fornecido pelo próprio feed. Não armazenamos o artigo completo de terceiros. */
    excerpt: text('excerpt'),
    author: text('author'),
    publishedAt: text('published_at'),
    collectedAt: text('collected_at').notNull().default(now),
    contentHash: text('content_hash').notNull(),
    titleFingerprint: text('title_fingerprint').notNull(),
    topics: text('topics', { mode: 'json' }).$type<string[]>().notNull().default(sql`'[]'`),
    suggestedStatus: text('suggested_status').$type<VerificationStatus>().notNull().default('in_review'),
    /** Frases que indicam afirmação não confirmada ("segundo fontes", "rumor", "leak"...). */
    flags: text('flags', { mode: 'json' }).$type<string[]>().notNull().default(sql`'[]'`),
    status: text('status').$type<SourceItemStatus>().notNull().default('new'),
    duplicateOfId: integer('duplicate_of_id').references((): AnySQLiteColumn => sourceItems.id, {
      onDelete: 'set null',
    }),
    articleId: integer('article_id').references((): AnySQLiteColumn => articles.id, { onDelete: 'set null' }),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('source_items_canonical_url_uq').on(t.canonicalUrl),
    uniqueIndex('source_items_source_guid_uq').on(t.sourceId, t.guid),
    index('source_items_status_idx').on(t.status, t.collectedAt),
    index('source_items_fingerprint_idx').on(t.titleFingerprint),
  ],
);

export const contentAssets = sqliteTable(
  'content_assets',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    kind: text('kind').$type<'image' | 'video' | 'package' | 'upload'>().notNull(),
    articleId: integer('article_id').references((): AnySQLiteColumn => articles.id, { onDelete: 'set null' }),
    title: text('title').notNull(),
    storageKey: text('storage_key'),
    mimeType: text('mime_type'),
    sizeBytes: integer('size_bytes'),
    width: integer('width'),
    height: integer('height'),
    alt: text('alt'),
    /** Licença/origem do ativo: "original", "oficial-com-permissao", "cc-by" etc. */
    license: text('license').notNull().default('original'),
    credit: text('credit'),
    /** Para pacotes do estúdio: títulos, roteiros, legendas, cenas. */
    data: text('data', { mode: 'json' }).$type<Record<string, unknown>>(),
    createdBy: integer('created_by').references(() => adminUsers.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (t) => [index('content_assets_article_idx').on(t.articleId), index('content_assets_kind_idx').on(t.kind)],
);

export const articles = sqliteTable(
  'articles',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    slug: text('slug').notNull().unique(),
    title: text('title').notNull(),
    summary: text('summary').notNull(),
    /** Markdown restrito (sem HTML bruto). Renderizado com sanitização no frontend. */
    body: text('body').notNull(),
    categoryId: integer('category_id')
      .notNull()
      .references(() => categories.id),
    verificationStatus: text('verification_status').$type<VerificationStatus>().notNull(),
    approvalStatus: text('approval_status').$type<ApprovalStatus>().notNull().default('draft'),
    authorName: text('author_name').notNull(),
    coverAssetId: integer('cover_asset_id').references((): AnySQLiteColumn => contentAssets.id, {
      onDelete: 'set null',
    }),
    coverAlt: text('cover_alt'),
    featured: integer('featured', { mode: 'boolean' }).notNull().default(false),
    tags: text('tags', { mode: 'json' }).$type<string[]>().notNull().default(sql`'[]'`),
    aiAssisted: integer('ai_assisted', { mode: 'boolean' }).notNull().default(false),
    sourceItemId: integer('source_item_id'),
    approvedBy: integer('approved_by').references(() => adminUsers.id, { onDelete: 'set null' }),
    approvedAt: text('approved_at'),
    reviewNote: text('review_note'),
    publishedAt: text('published_at'),
    createdBy: integer('created_by').references(() => adminUsers.id, { onDelete: 'set null' }),
    updatedBy: integer('updated_by').references(() => adminUsers.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('articles_public_idx').on(t.approvalStatus, t.publishedAt),
    index('articles_category_idx').on(t.categoryId),
  ],
);

export const articleSources = sqliteTable(
  'article_sources',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    articleId: integer('article_id')
      .notNull()
      .references(() => articles.id, { onDelete: 'cascade' }),
    sourceId: integer('source_id').references(() => sources.id, { onDelete: 'set null' }),
    url: text('url').notNull(),
    title: text('title').notNull(),
    publisher: text('publisher').notNull(),
    publishedAt: text('published_at'),
    isPrimary: integer('is_primary', { mode: 'boolean' }).notNull().default(false),
    accessedAt: text('accessed_at').notNull().default(now),
  },
  (t) => [uniqueIndex('article_sources_uq').on(t.articleId, t.url)],
);

export const claims = sqliteTable(
  'claims',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    articleId: integer('article_id')
      .notNull()
      .references(() => articles.id, { onDelete: 'cascade' }),
    text: text('text').notNull(),
    status: text('status').$type<VerificationStatus>().notNull(),
    sourceUrl: text('source_url'),
    notes: text('notes'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('claims_article_idx').on(t.articleId)],
);

export const guideEntries = sqliteTable(
  'guide_entries',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    kind: text('kind').$type<GuideKind>().notNull(),
    slug: text('slug').notNull(),
    title: text('title').notNull(),
    summary: text('summary').notNull(),
    body: text('body').notNull().default(''),
    verificationStatus: text('verification_status').$type<VerificationStatus>().notNull(),
    eventDate: text('event_date'),
    sortOrder: integer('sort_order').notNull().default(0),
    sources: text('sources', { mode: 'json' }).$type<{ url: string; label: string }[]>().notNull().default(sql`'[]'`),
    published: integer('published', { mode: 'boolean' }).notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('guide_entries_kind_slug_uq').on(t.kind, t.slug)],
);

export const discoveries = sqliteTable('discoveries', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  kind: text('kind').$type<DiscoveryKind>().notNull(),
  description: text('description').notNull(),
  game: text('game').notNull().default('GTA VI'),
  gameVersion: text('game_version'),
  platforms: text('platforms', { mode: 'json' }).$type<string[]>().notNull().default(sql`'[]'`),
  steps: text('steps', { mode: 'json' }).$type<string[]>().notNull().default(sql`'[]'`),
  evidence: text('evidence', { mode: 'json' }).$type<{ url: string; label: string }[]>().notNull().default(sql`'[]'`),
  sourceUrl: text('source_url'),
  verificationStatus: text('verification_status').$type<VerificationStatus>().notNull(),
  lastConfirmedAt: text('last_confirmed_at'),
  riskWarning: text('risk_warning'),
  fixedInVersion: text('fixed_in_version'),
  /** Histórico de versões: cada edição relevante adiciona uma entrada. */
  history: text('history', { mode: 'json' })
    .$type<{ at: string; by: string; note: string }[]>()
    .notNull()
    .default(sql`'[]'`),
  published: integer('published', { mode: 'boolean' }).notNull().default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const products = sqliteTable(
  'products',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    category: text('category').$type<ProductCategory>().notNull(),
    description: text('description'),
    imageUrl: text('image_url'),
    priceCents: integer('price_cents'),
    currency: text('currency').notNull().default('BRL'),
    priceCheckedAt: text('price_checked_at'),
    availability: text('availability').$type<Availability>().notNull().default('unknown'),
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('products_active_idx').on(t.active, t.sortOrder)],
);

export const affiliateLinks = sqliteTable(
  'affiliate_links',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    productId: integer('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    store: text('store').notNull(),
    url: text('url').notNull(),
    program: text('program'),
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('affiliate_links_product_idx').on(t.productId)],
);

export const banners = sqliteTable(
  'banners',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    slot: text('slot').$type<BannerSlot>().notNull(),
    title: text('title').notNull(),
    subtitle: text('subtitle'),
    description: text('description'),
    imageUrl: text('image_url'),
    ctaLabel: text('cta_label').notNull(),
    productId: integer('product_id').references(() => products.id, { onDelete: 'set null' }),
    store: text('store'),
    targetUrl: text('target_url').notNull(),
    priority: integer('priority').notNull().default(0),
    startsAt: text('starts_at'),
    endsAt: text('ends_at'),
    status: text('status').$type<BannerStatus>().notNull().default('draft'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('banners_slot_idx').on(t.slot, t.status, t.priority)],
);

export const channels = sqliteTable('channels', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  kind: text('kind').$type<ChannelKind>().notNull(),
  label: text('label').notNull(),
  url: text('url').notNull(),
  description: text('description'),
  active: integer('active', { mode: 'boolean' }).notNull().default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/**
 * Cliques em links afiliados/canais. Sem IP, sem cookie de rastreamento, sem user-agent:
 * apenas o alvo, a posição e o domínio de referência. Retenção: ver CLICK_RETENTION_DAYS.
 */
export const clickEvents = sqliteTable(
  'click_events',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    targetType: text('target_type').$type<'banner' | 'product' | 'channel'>().notNull(),
    targetId: integer('target_id').notNull(),
    placement: text('placement').notNull(),
    referrerHost: text('referrer_host'),
    createdAt: createdAt(),
  },
  (t) => [
    index('click_events_target_idx').on(t.targetType, t.targetId),
    index('click_events_created_idx').on(t.createdAt),
  ],
);

/** Visitas agregadas por dia e caminho — nenhuma informação individual do visitante. */
export const pageViewsDaily = sqliteTable(
  'page_views_daily',
  {
    day: text('day').notNull(),
    path: text('path').notNull(),
    views: integer('views').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.day, t.path] })],
);

export const pipelineRuns = sqliteTable(
  'pipeline_runs',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    kind: text('kind').$type<'collect' | 'reprocess' | 'export'>().notNull(),
    status: text('status').$type<'running' | 'success' | 'partial' | 'failed'>().notNull(),
    trigger: text('trigger').notNull(),
    startedAt: text('started_at').notNull().default(now),
    finishedAt: text('finished_at'),
    stats: text('stats', { mode: 'json' })
      .$type<Record<string, number>>()
      .notNull()
      .default(sql`'{}'`),
    error: text('error'),
  },
  (t) => [index('pipeline_runs_started_idx').on(t.startedAt)],
);

export const pipelineLogs = sqliteTable(
  'pipeline_logs',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    runId: integer('run_id')
      .notNull()
      .references(() => pipelineRuns.id, { onDelete: 'cascade' }),
    sourceId: integer('source_id').references(() => sources.id, { onDelete: 'set null' }),
    level: text('level').$type<'info' | 'warn' | 'error'>().notNull(),
    message: text('message').notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('pipeline_logs_run_idx').on(t.runId)],
);

export const auditLogs = sqliteTable(
  'audit_logs',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id').references(() => adminUsers.id, { onDelete: 'set null' }),
    userEmail: text('user_email'),
    action: text('action').notNull(),
    entity: text('entity').notNull(),
    entityId: text('entity_id'),
    details: text('details', { mode: 'json' }).$type<Record<string, unknown>>(),
    createdAt: createdAt(),
  },
  (t) => [index('audit_logs_created_idx').on(t.createdAt), index('audit_logs_entity_idx').on(t.entity, t.entityId)],
);

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value', { mode: 'json' }).$type<unknown>().notNull(),
  updatedAt: updatedAt(),
});

/** Fatos-chave exibidos na faixa da home, cada um com status e fonte. */
export const facts = sqliteTable('facts', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  status: text('status').$type<VerificationStatus>().notNull(),
  sourceUrl: text('source_url').notNull(),
  updatedAt: updatedAt(),
});
