import { and, desc, eq, gte, or } from 'drizzle-orm';
import { pipelineLogs, pipelineRuns, sourceItems, sources, type Db } from '@pgi/db';
import {
  DUPLICATE_TITLE_THRESHOLD,
  contentHash,
  jaccard,
  normalizeUrl,
  titleFingerprint,
} from '@pgi/shared';
import { classify, matchesKeywords } from './classify.ts';
import { parseFeed, type FeedEntry } from './feed.ts';
import { USER_AGENT, robotsAllows } from './robots.ts';

const MAX_FEED_BYTES = 5 * 1024 * 1024;
const MAX_ITEMS_PER_SOURCE = 100;
const DEDUPE_WINDOW_DAYS = 14;

export interface CollectOptions {
  trigger: string;
  /** Reprocessa apenas uma fonte (inclusive desativada). */
  sourceId?: number;
  fetchImpl?: typeof fetch;
  log?: (msg: string) => void;
}

export interface CollectResult {
  runId: number;
  status: 'success' | 'partial' | 'failed';
  stats: Record<string, number>;
}

type SourceRow = typeof sources.$inferSelect;

async function fetchFeed(source: SourceRow, fetchImpl: typeof fetch): Promise<{ notModified: true } | { notModified: false; xml: string; etag: string | null; lastModified: string | null }> {
  const headers: Record<string, string> = { 'User-Agent': USER_AGENT, Accept: 'application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.8' };
  if (source.etag) headers['If-None-Match'] = source.etag;
  if (source.lastModified) headers['If-Modified-Since'] = source.lastModified;
  const res = await fetchImpl(source.feedUrl!, { headers, signal: AbortSignal.timeout(20_000), redirect: 'follow' });
  if (res.status === 304) return { notModified: true };
  if (res.status === 429) throw new Error('Limite de acesso atingido (HTTP 429). A fonte será tentada na próxima execução.');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const len = Number(res.headers.get('content-length') ?? 0);
  if (len > MAX_FEED_BYTES) throw new Error('Feed maior que o limite de 5 MB.');
  const xml = await res.text();
  if (xml.length > MAX_FEED_BYTES) throw new Error('Feed maior que o limite de 5 MB.');
  return { notModified: false, xml, etag: res.headers.get('etag'), lastModified: res.headers.get('last-modified') };
}

/**
 * Procura duplicatas: mesma URL canônica, mesmo guid na fonte, ou título muito semelhante
 * a um item recente de qualquer fonte. Retorna o id do item original, se houver.
 */
async function findDuplicate(db: Db, sourceId: number, entry: FeedEntry, canonical: string, fingerprint: string): Promise<{ exact: boolean; id: number } | null> {
  const exact = await db
    .select({ id: sourceItems.id })
    .from(sourceItems)
    .where(or(eq(sourceItems.canonicalUrl, canonical), entry.guid ? and(eq(sourceItems.sourceId, sourceId), eq(sourceItems.guid, entry.guid)) : undefined))
    .limit(1);
  if (exact[0]) return { exact: true, id: exact[0].id };

  const since = new Date(Date.now() - DEDUPE_WINDOW_DAYS * 86_400_000).toISOString();
  const recent = await db
    .select({ id: sourceItems.id, title: sourceItems.title, fp: sourceItems.titleFingerprint, dup: sourceItems.duplicateOfId })
    .from(sourceItems)
    .where(gte(sourceItems.collectedAt, since))
    .orderBy(desc(sourceItems.collectedAt))
    .limit(500);
  for (const r of recent) {
    if (r.fp === fingerprint || jaccard(r.title, entry.title) >= DUPLICATE_TITLE_THRESHOLD) {
      return { exact: false, id: r.dup ?? r.id };
    }
  }
  return null;
}

export async function collectSource(db: Db, runId: number, source: SourceRow, fetchImpl: typeof fetch): Promise<Record<string, number>> {
  const stats = { fetched: 0, matched: 0, inserted: 0, duplicates: 0, skipped: 0 };
  const logTo = (level: 'info' | 'warn' | 'error', message: string) => db.insert(pipelineLogs).values({ runId, sourceId: source.id, level, message: message.slice(0, 1000) });
  const now = new Date().toISOString();

  if (source.method !== 'rss' || !source.feedUrl) {
    await logTo('info', `Fonte de acompanhamento ${source.method === 'manual' ? 'manual' : 'sem coletor automático'}: nada a coletar.`);
    await db.update(sources).set({ lastRunAt: now, lastStatus: 'skipped' }).where(eq(sources.id, source.id));
    stats.skipped = 1;
    return stats;
  }

  if (!(await robotsAllows(source.feedUrl, fetchImpl))) {
    await logTo('warn', 'robots.txt não permite o acesso ao feed (ou não pôde ser lido). Coleta não realizada.');
    await db.update(sources).set({ lastRunAt: now, lastStatus: 'skipped', lastError: 'Bloqueado por robots.txt' }).where(eq(sources.id, source.id));
    stats.skipped = 1;
    return stats;
  }

  const result = await fetchFeed(source, fetchImpl);
  if (result.notModified) {
    await logTo('info', 'Feed sem alterações desde a última coleta (HTTP 304).');
    await db.update(sources).set({ lastRunAt: now, lastSuccessAt: now, lastStatus: 'ok', lastError: null, consecutiveFailures: 0 }).where(eq(sources.id, source.id));
    return stats;
  }

  const entries = parseFeed(result.xml).slice(0, MAX_ITEMS_PER_SOURCE);
  if (entries.length === 0) throw new Error('O feed não retornou itens válidos (formato inesperado?).');
  stats.fetched = entries.length;

  for (const entry of entries) {
    const haystack = `${entry.title} ${entry.excerpt ?? ''}`;
    if (!matchesKeywords(haystack, source.keywords)) continue;
    stats.matched++;
    const canonical = normalizeUrl(entry.url);
    const fingerprint = titleFingerprint(entry.title);
    const dup = await findDuplicate(db, source.id, entry, canonical, fingerprint);
    if (dup?.exact) continue; // já coletado
    const c = classify(haystack, source.type);
    await db
      .insert(sourceItems)
      .values({
        sourceId: source.id,
        guid: entry.guid,
        url: entry.url,
        canonicalUrl: canonical,
        title: entry.title,
        excerpt: entry.excerpt,
        author: entry.author,
        publishedAt: entry.publishedAt,
        contentHash: contentHash(`${entry.title}\n${entry.excerpt ?? ''}`),
        titleFingerprint: fingerprint,
        topics: c.topics,
        flags: c.flags,
        suggestedStatus: c.suggestedStatus,
        status: dup ? 'duplicate' : 'new',
        duplicateOfId: dup?.id ?? null,
      })
      .onConflictDoNothing();
    if (dup) stats.duplicates++;
    else stats.inserted++;
  }

  await db
    .update(sources)
    .set({ lastRunAt: now, lastSuccessAt: now, lastStatus: 'ok', lastError: null, consecutiveFailures: 0, etag: result.etag, lastModified: result.lastModified })
    .where(eq(sources.id, source.id));
  await logTo('info', `${stats.fetched} itens lidos, ${stats.matched} sobre GTA VI, ${stats.inserted} novos, ${stats.duplicates} possíveis duplicatas.`);
  return stats;
}

/**
 * Executa a coleta. Uma fonte com falha não interrompe as demais, e os itens já
 * coletados são preservados (nunca apagamos a última versão válida).
 */
export async function runCollection(db: Db, opts: CollectOptions): Promise<CollectResult> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const log = opts.log ?? (() => undefined);
  const [run] = await db.insert(pipelineRuns).values({ kind: opts.sourceId ? 'reprocess' : 'collect', status: 'running', trigger: opts.trigger }).returning({ id: pipelineRuns.id });
  const runId = run!.id;

  const list = opts.sourceId
    ? await db.select().from(sources).where(eq(sources.id, opts.sourceId))
    : await db.select().from(sources).where(eq(sources.enabled, true));

  const totals: Record<string, number> = { sources: list.length, failed: 0, fetched: 0, matched: 0, inserted: 0, duplicates: 0, skipped: 0 };
  for (const source of list) {
    try {
      const s = await collectSource(db, runId, source, fetchImpl);
      for (const [k, v] of Object.entries(s)) totals[k] = (totals[k] ?? 0) + v;
      log(`[${source.name}] ok ${JSON.stringify(s)}`);
    } catch (err) {
      totals.failed!++;
      const message = err instanceof Error ? err.message : String(err);
      log(`[${source.name}] falhou: ${message}`);
      await db.insert(pipelineLogs).values({ runId, sourceId: source.id, level: 'error', message: message.slice(0, 1000) });
      await db
        .update(sources)
        .set({ lastRunAt: new Date().toISOString(), lastStatus: 'error', lastError: message.slice(0, 500), consecutiveFailures: source.consecutiveFailures + 1 })
        .where(eq(sources.id, source.id));
    }
  }

  const attempted = list.length - (totals.skipped ?? 0);
  const status: CollectResult['status'] =
    totals.failed === 0 ? 'success' : totals.failed! >= attempted && attempted > 0 ? 'failed' : 'partial';
  await db
    .update(pipelineRuns)
    .set({ status, finishedAt: new Date().toISOString(), stats: totals, error: totals.failed ? `${totals.failed} fonte(s) com falha` : null })
    .where(eq(pipelineRuns.id, runId));
  return { runId, status, stats: totals };
}
