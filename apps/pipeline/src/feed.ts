import { XMLParser } from 'fast-xml-parser';
import { stripHtml, truncate } from '@pgi/shared';

export interface FeedEntry {
  guid: string | null;
  url: string;
  title: string;
  excerpt: string | null;
  author: string | null;
  publishedAt: string | null;
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@',
  textNodeName: '#text',
  processEntities: true,
  // Evita expansão abusiva de entidades (XML bomb).
  htmlEntities: false,
  isArray: (name) => name === 'item' || name === 'entry' || name === 'link' || name === 'category',
});

function text(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string' || typeof v === 'number') return String(v);
  if (typeof v === 'object' && '#text' in (v as Record<string, unknown>)) return String((v as Record<string, unknown>)['#text']);
  return '';
}

/** Converte datas RFC-822 (RSS) e ISO-8601 (Atom) para ISO em UTC. */
export function normalizeDate(raw: unknown): string | null {
  const s = text(raw).trim();
  if (!s) return null;
  const t = Date.parse(s);
  if (Number.isNaN(t)) return null;
  // Datas no futuro distante indicam erro do feed.
  if (t > Date.now() + 2 * 86_400_000) return null;
  return new Date(t).toISOString();
}

function atomLink(links: unknown): string {
  if (!Array.isArray(links)) return text(links);
  const alt = links.find((l) => typeof l === 'object' && l && ((l as Record<string, string>)['@rel'] ?? 'alternate') === 'alternate');
  const pick = (alt ?? links[0]) as Record<string, string> | string | undefined;
  if (!pick) return '';
  return typeof pick === 'string' ? pick : pick['@href'] ?? text(pick);
}

export function parseFeed(xml: string): FeedEntry[] {
  const doc = parser.parse(xml) as Record<string, any>;
  const out: FeedEntry[] = [];
  const clean = (html: string, max: number) => {
    const t = stripHtml(html);
    return t ? truncate(t, max) : null;
  };

  const rssItems: any[] = doc?.rss?.channel?.item ?? doc?.['rdf:RDF']?.item ?? [];
  for (const it of rssItems) {
    const link = Array.isArray(it.link) ? text(it.link[0]) : text(it.link);
    const url = link.trim() || text(it.guid).trim();
    const title = stripHtml(text(it.title));
    if (!url || !title) continue;
    out.push({
      guid: text(it.guid).trim() || null,
      url,
      title: truncate(title, 300),
      excerpt: clean(text(it.description) || text(it['content:encoded']), 600),
      author: (text(it['dc:creator']) || text(it.author)).trim().slice(0, 120) || null,
      publishedAt: normalizeDate(it.pubDate ?? it['dc:date']),
    });
  }

  const atomEntries: any[] = doc?.feed?.entry ?? [];
  for (const it of atomEntries) {
    const url = atomLink(it.link).trim();
    const title = stripHtml(text(it.title));
    if (!url || !title) continue;
    out.push({
      guid: text(it.id).trim() || null,
      url,
      title: truncate(title, 300),
      excerpt: clean(text(it.summary) || text(it.content), 600),
      author: text(it.author?.name).trim().slice(0, 120) || null,
      publishedAt: normalizeDate(it.published ?? it.updated),
    });
  }
  return out;
}
