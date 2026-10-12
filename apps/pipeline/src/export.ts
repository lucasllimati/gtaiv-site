import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { buildPublicSiteData, getPublicArticle, type AssetUrlResolver, type Db } from '@pgi/db';
import type { PublicSiteData } from '@pgi/shared';

const xmlEscape = (s: string) =>
  s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]!);

export const STATIC_ROUTES = [
  '/',
  '/noticias',
  '/oficiais',
  '/rumores',
  '/historia',
  '/personagens',
  '/mapa',
  '/universo',
  '/glitches',
  '/guias',
  '/ofertas',
  '/sobre',
  '/contato',
  '/politica-de-privacidade',
  '/termos',
  '/divulgacao',
];

export function buildSitemap(siteUrl: string, data: PublicSiteData): string {
  const base = siteUrl.replace(/\/$/, '');
  const urls = [
    ...STATIC_ROUTES.map((p) => ({ loc: `${base}${p === '/' ? '/' : p}`, lastmod: data.generatedAt })),
    ...data.articles.map((a) => ({ loc: `${base}/noticias/${a.slug}`, lastmod: a.updatedAt })),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${xmlEscape(u.loc)}</loc><lastmod>${u.lastmod.slice(0, 10)}</lastmod></url>`).join('\n')}
</urlset>
`;
}

export function buildRss(siteUrl: string, data: PublicSiteData): string {
  const base = siteUrl.replace(/\/$/, '');
  const items = data.articles.slice(0, 30).map(
    (a) => `    <item>
      <title>${xmlEscape(a.title)}</title>
      <link>${xmlEscape(`${base}/noticias/${a.slug}`)}</link>
      <guid isPermaLink="true">${xmlEscape(`${base}/noticias/${a.slug}`)}</guid>
      <pubDate>${new Date(a.publishedAt).toUTCString()}</pubDate>
      <category>${xmlEscape(a.category.name)}</category>
      <description>${xmlEscape(a.summary)}</description>
    </item>`,
  );
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${xmlEscape(data.settings.siteName)}</title>
    <link>${xmlEscape(base + '/')}</link>
    <description>${xmlEscape(data.settings.tagline)}</description>
    <language>pt-BR</language>
    <lastBuildDate>${new Date(data.generatedAt).toUTCString()}</lastBuildDate>
${items.join('\n')}
  </channel>
</rss>
`;
}

export function buildRobots(siteUrl: string): string {
  const base = siteUrl.replace(/\/$/, '');
  return `User-agent: *
Allow: /
Disallow: /admin

Sitemap: ${base}/sitemap.xml
`;
}

/**
 * Gera o snapshot estático usado pelo site quando a API não está disponível
 * (por exemplo, no GitHub Pages): /data/site.json, /data/articles/<slug>.json,
 * além de sitemap.xml, rss.xml e robots.txt.
 */
export async function exportSnapshot(db: Db, opts: { outDir: string; siteUrl: string; resolve: AssetUrlResolver }): Promise<{ articles: number }> {
  const data = await buildPublicSiteData(db, { origin: 'snapshot', resolve: opts.resolve });
  const dataDir = join(opts.outDir, 'data');
  await rm(dataDir, { recursive: true, force: true });
  await mkdir(join(dataDir, 'articles'), { recursive: true });
  await writeFile(join(dataDir, 'site.json'), JSON.stringify(data));
  for (const a of data.articles) {
    const full = await getPublicArticle(db, a.slug, opts.resolve);
    if (full) await writeFile(join(dataDir, 'articles', `${a.slug}.json`), JSON.stringify(full));
  }
  await writeFile(join(opts.outDir, 'sitemap.xml'), buildSitemap(opts.siteUrl, data));
  await writeFile(join(opts.outDir, 'rss.xml'), buildRss(opts.siteUrl, data));
  await writeFile(join(opts.outDir, 'robots.txt'), buildRobots(opts.siteUrl));
  return { articles: data.articles.length };
}
