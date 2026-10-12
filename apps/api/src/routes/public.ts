import type { FastifyInstance } from 'fastify';
import { and, eq, sql } from 'drizzle-orm';
import {
  activeBanners,
  affiliateLinks,
  buildPublicSiteData,
  channels,
  clickEvents,
  getPublicArticle,
  pageViewsDaily,
  products,
} from '@pgi/db';
import { pageViewSchema } from '@pgi/shared';
import type { AppContext } from '../app.ts';
import { notFound, parse } from '../lib/http.ts';

const PLACEMENT_RE = /^[a-z0-9_:-]{1,60}$/i;

export async function publicRoutes(app: FastifyInstance, ctx: AppContext): Promise<void> {
  const { db, storage } = ctx;
  const resolve = (key: string) => storage.url(key);

  app.get('/api/public/site', async (_req, reply) => {
    const data = await buildPublicSiteData(db, { origin: 'api', resolve });
    return reply.header('Cache-Control', 'public, max-age=60, stale-while-revalidate=300').send(data);
  });

  app.get('/api/public/articles/:slug', async (req, reply) => {
    const { slug } = req.params as { slug: string };
    if (!/^[a-z0-9-]{1,100}$/.test(slug)) throw notFound('Artigo');
    const article = await getPublicArticle(db, slug, resolve);
    if (!article) throw notFound('Artigo');
    return reply.header('Cache-Control', 'public, max-age=60').send(article);
  });

  /** Contador agregado de visitas por dia e caminho. Não grava IP, cookie ou user-agent. */
  app.post('/api/public/view', { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (req, reply) => {
    const { path } = parse(pageViewSchema, req.body);
    const day = new Date().toISOString().slice(0, 10);
    const clean = path.split('?')[0]!.slice(0, 200);
    await db
      .insert(pageViewsDaily)
      .values({ day, path: clean, views: 1 })
      .onConflictDoUpdate({ target: [pageViewsDaily.day, pageViewsDaily.path], set: { views: sql`${pageViewsDaily.views} + 1` } });
    return reply.status(204).send();
  });

  /**
   * Redirecionamento rastreado para links afiliados e canais.
   * O destino vem SEMPRE do banco (nunca da query string), o que impede redirecionamento aberto.
   */
  app.get('/go/:type/:id', { config: { rateLimit: { max: 120, timeWindow: '1 minute' } } }, async (req, reply) => {
    const { type, id: rawId } = req.params as { type: string; id: string };
    const id = Number(rawId);
    const placementRaw = (req.query as { p?: string }).p ?? 'unknown';
    const placement = PLACEMENT_RE.test(placementRaw) ? placementRaw : 'unknown';
    if (!Number.isInteger(id) || id <= 0) throw notFound('Link');

    let target: string | undefined;
    let targetType: 'banner' | 'product' | 'channel';
    if (type === 'banner') {
      targetType = 'banner';
      target = (await activeBanners(db)).find((b) => b.id === id)?.url;
    } else if (type === 'product') {
      targetType = 'product';
      const [row] = await db
        .select({ url: affiliateLinks.url })
        .from(affiliateLinks)
        .innerJoin(products, eq(products.id, affiliateLinks.productId))
        .where(and(eq(products.id, id), eq(products.active, true), eq(affiliateLinks.active, true)))
        .limit(1);
      target = row?.url;
    } else if (type === 'channel') {
      targetType = 'channel';
      const [row] = await db.select({ url: channels.url }).from(channels).where(and(eq(channels.id, id), eq(channels.active, true)));
      target = row?.url;
    } else {
      throw notFound('Link');
    }
    if (!target) throw notFound('Link');

    let referrerHost: string | null = null;
    try {
      referrerHost = req.headers.referer ? new URL(req.headers.referer).hostname.slice(0, 100) : null;
    } catch {
      referrerHost = null;
    }
    await db.insert(clickEvents).values({ targetType, targetId: id, placement, referrerHost });
    return reply.header('Cache-Control', 'no-store').header('X-Robots-Tag', 'noindex').redirect(target, 302);
  });
}
