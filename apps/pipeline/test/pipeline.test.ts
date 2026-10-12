import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { createDb, migrateDb, pipelineLogs, sourceItems, sources, type Db } from '@pgi/db';
import { classify, clearRobotsCache, isAllowed, matchesKeywords, parseFeed, parseRobots, runCollection } from '../src/index.ts';

const rss = (items: { title: string; link: string; guid?: string; desc?: string; date?: string }[]) => `<?xml version="1.0"?>
<rss version="2.0"><channel><title>Feed</title>
${items
  .map(
    (i) => `<item><title><![CDATA[${i.title}]]></title><link>${i.link}</link>${i.guid ? `<guid>${i.guid}</guid>` : ''}
<description><![CDATA[<p>${i.desc ?? ''}</p><script>alert(1)</script>]]></description><pubDate>${i.date ?? 'Mon, 12 Oct 2026 10:00:00 GMT'}</pubDate></item>`,
  )
  .join('\n')}
</channel></rss>`;

const atom = `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><title>A</title>
<entry><id>tag:x,1</id><title>GTA 6 radio stations</title><link rel="alternate" href="https://example.com/radio"/><updated>2026-10-08T09:00:00Z</updated><summary>Six stations</summary></entry></feed>`;

describe('parseFeed', () => {
  it('lê RSS, remove HTML/script e normaliza datas', () => {
    const [e] = parseFeed(rss([{ title: 'GTA 6 trailer', link: 'https://a.com/x', guid: 'g1', desc: 'Novo <b>trailer</b>' }]));
    expect(e).toMatchObject({ title: 'GTA 6 trailer', url: 'https://a.com/x', guid: 'g1', publishedAt: '2026-10-12T10:00:00.000Z' });
    expect(e!.excerpt).toBe('Novo trailer');
  });
  it('lê Atom', () => {
    const [e] = parseFeed(atom);
    expect(e).toMatchObject({ url: 'https://example.com/radio', guid: 'tag:x,1', publishedAt: '2026-10-08T09:00:00.000Z' });
  });
});

describe('classificação', () => {
  it('identifica rumores e assuntos', () => {
    const c = classify('GTA 6 leaker threatens to release build, according to sources', 'press');
    expect(c.suggestedStatus).toBe('rumor');
    expect(c.flags).toContain('vazamento');
  });
  it('fonte oficial sugere confirmado', () => {
    expect(classify('Grand Theft Auto VI release date', 'official').suggestedStatus).toBe('confirmed');
  });
  it('filtro de palavras-chave respeita limites de palavra', () => {
    expect(matchesKeywords('New GTA 6 trailer', ['gta 6'])).toBe(true);
    expect(matchesKeywords('Top GTA 60 mods', ['gta 6'])).toBe(false);
  });
});

describe('robots.txt', () => {
  it('aplica a regra mais específica', () => {
    const g = parseRobots('User-agent: *\nDisallow: /private\nAllow: /private/feed\n');
    expect(isAllowed(g, '/feed')).toBe(true);
    expect(isAllowed(g, '/private/x')).toBe(false);
    expect(isAllowed(g, '/private/feed')).toBe(true);
  });
});

describe('runCollection', () => {
  let db: Db;
  let feedA: string;
  let feedB: string;
  let robots: string;
  let failB: boolean;

  const fetchImpl = (async (input: string | URL | Request) => {
    const url = String(input);
    if (url.endsWith('/robots.txt')) return new Response(robots, { status: 200 });
    if (url.startsWith('https://a.test/feed')) return new Response(feedA, { status: 200 });
    if (url.startsWith('https://b.test/feed')) return failB ? new Response('erro', { status: 500 }) : new Response(feedB, { status: 200 });
    return new Response('not found', { status: 404 });
  }) as typeof fetch;

  beforeEach(async () => {
    clearRobotsCache();
    ({ db } = createDb(':memory:'));
    await migrateDb(db);
    await db.insert(sources).values([
      { name: 'A', siteUrl: 'https://a.test', feedUrl: 'https://a.test/feed', type: 'press', method: 'rss', reliability: 4, keywords: ['gta 6', 'gta vi'] },
      { name: 'B', siteUrl: 'https://b.test', feedUrl: 'https://b.test/feed', type: 'press', method: 'rss', reliability: 4, keywords: ['gta 6'] },
      { name: 'Oficial', siteUrl: 'https://o.test', type: 'official', method: 'manual', reliability: 5 },
    ]);
    robots = 'User-agent: *\nAllow: /\n';
    failB = false;
    feedA = rss([
      { title: 'GTA 6 leaker threatens to release full build', link: 'https://a.test/leak?utm_source=rss', guid: 'a1' },
      { title: 'Elden Ring DLC review', link: 'https://a.test/elden', guid: 'a2' },
    ]);
    feedB = rss([{ title: 'GTA 6 leaker threatens release of a full build', link: 'https://b.test/leak', guid: 'b1' }]);
  });

  it('coleta, filtra por palavra-chave e marca duplicatas por similaridade', async () => {
    const r = await runCollection(db, { trigger: 'test', fetchImpl });
    expect(r.status).toBe('success');
    const items = await db.select().from(sourceItems);
    expect(items).toHaveLength(2);
    const dup = items.find((i) => i.status === 'duplicate');
    expect(dup?.canonicalUrl).toBe('https://b.test/leak');
    expect(items.find((i) => i.status === 'new')?.canonicalUrl).toBe('https://a.test/leak');
    expect(r.stats.skipped).toBe(1); // fonte manual
  });

  it('não duplica itens já coletados em execuções seguintes', async () => {
    await runCollection(db, { trigger: 'test', fetchImpl });
    const r2 = await runCollection(db, { trigger: 'test', fetchImpl });
    expect(r2.stats.inserted).toBe(0);
    expect(await db.select().from(sourceItems)).toHaveLength(2);
  });

  it('falha de uma fonte não apaga dados e é registrada', async () => {
    await runCollection(db, { trigger: 'test', fetchImpl });
    failB = true;
    const r = await runCollection(db, { trigger: 'test', fetchImpl });
    expect(r.status).toBe('partial');
    const [b] = await db.select().from(sources).where(eq(sources.name, 'B'));
    expect(b!.lastStatus).toBe('error');
    expect(b!.consecutiveFailures).toBe(1);
    expect(await db.select().from(sourceItems)).toHaveLength(2);
    const logs = await db.select().from(pipelineLogs).where(eq(pipelineLogs.runId, r.runId));
    expect(logs.some((l) => l.level === 'error' && l.message.includes('HTTP 500'))).toBe(true);
  });

  it('respeita robots.txt', async () => {
    robots = 'User-agent: *\nDisallow: /feed\n';
    const r = await runCollection(db, { trigger: 'test', fetchImpl });
    expect(r.stats.inserted).toBe(0);
    expect(await db.select().from(sourceItems)).toHaveLength(0);
  });

  it('reprocessa uma única fonte', async () => {
    const [a] = await db.select().from(sources).where(eq(sources.name, 'A'));
    const r = await runCollection(db, { trigger: 'test', sourceId: a!.id, fetchImpl });
    expect(r.stats.sources).toBe(1);
  });
});
