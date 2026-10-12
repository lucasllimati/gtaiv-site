import type { FastifyInstance } from 'fastify';
import { asc, desc, eq } from 'drizzle-orm';
import { affiliateLinks, articles, banners, channels, products } from '@pgi/db';
import {
  AVAILABILITY_LABELS,
  bannerInputSchema,
  channelInputSchema,
  isPriceFresh,
  productInputSchema,
} from '@pgi/shared';
import { z } from 'zod';
import type { AppContext } from '../../app.ts';
import { HttpError, badRequest, idParam, notFound, nowIso, parse } from '../../lib/http.ts';
import { requirePermission } from '../../plugins/auth.ts';
import { audit } from '../../services/audit.ts';
import { requestSiteRebuild } from '../../services/dispatch.ts';

const brl = (cents: number) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export async function commerceRoutes(app: FastifyInstance, ctx: AppContext): Promise<void> {
  const { db, config } = ctx;
  const rebuild = (why: string) => void requestSiteRebuild(config, why);

  // ---- Produtos e links afiliados ----
  app.get('/products', { preHandler: requirePermission('articles:read') }, async () => {
    const rows = await db.select({ p: products, link: affiliateLinks }).from(products).leftJoin(affiliateLinks, eq(affiliateLinks.productId, products.id)).orderBy(asc(products.sortOrder), asc(products.id));
    return rows.map(({ p, link }) => ({ ...p, affiliateUrl: link?.url ?? null, affiliateProgram: link?.program ?? null, store: link?.store ?? null, priceFresh: isPriceFresh(p.priceCheckedAt) }));
  });

  const validatePrice = (input: z.infer<typeof productInputSchema>) => {
    if (input.priceCents != null && !input.priceCheckedAt) {
      throw badRequest('Informe quando o preço foi verificado na loja. Preços sem data de verificação não são exibidos.');
    }
    if (input.priceCheckedAt && Date.parse(input.priceCheckedAt) > Date.now() + 5 * 60_000) {
      throw badRequest('A data de verificação do preço não pode estar no futuro.');
    }
  };

  app.post('/products', { preHandler: requirePermission('commerce:write') }, async (req, reply) => {
    const input = parse(productInputSchema, req.body);
    validatePrice(input);
    const { affiliateUrl, affiliateProgram, store, ...p } = input;
    const [row] = await db.insert(products).values({ ...p, description: p.description ?? null, priceCents: p.priceCents ?? null, priceCheckedAt: p.priceCheckedAt ?? null }).returning();
    await db.insert(affiliateLinks).values({ productId: row!.id, store, url: affiliateUrl, program: affiliateProgram ?? null });
    await audit(db, req.user, 'product.create', 'product', row!.id, { name: p.name, store });
    rebuild('products');
    return reply.status(201).send(row);
  });

  app.put('/products/:id', { preHandler: requirePermission('commerce:write') }, async (req) => {
    const id = idParam(req.params);
    const input = parse(productInputSchema, req.body);
    validatePrice(input);
    const { affiliateUrl, affiliateProgram, store, ...p } = input;
    const [row] = await db.update(products).set({ ...p, description: p.description ?? null, priceCents: p.priceCents ?? null, priceCheckedAt: p.priceCheckedAt ?? null, updatedAt: nowIso() }).where(eq(products.id, id)).returning();
    if (!row) throw notFound('Produto');
    const [link] = await db.select().from(affiliateLinks).where(eq(affiliateLinks.productId, id));
    if (link) await db.update(affiliateLinks).set({ store, url: affiliateUrl, program: affiliateProgram ?? null, updatedAt: nowIso() }).where(eq(affiliateLinks.id, link.id));
    else await db.insert(affiliateLinks).values({ productId: id, store, url: affiliateUrl, program: affiliateProgram ?? null });
    await audit(db, req.user, 'product.update', 'product', id, { name: p.name, priceCents: p.priceCents, active: p.active });
    rebuild('products');
    return row;
  });

  app.delete('/products/:id', { preHandler: requirePermission('commerce:write') }, async (req, reply) => {
    const id = idParam(req.params);
    await db.delete(products).where(eq(products.id, id));
    await audit(db, req.user, 'product.delete', 'product', id);
    rebuild('products');
    return reply.status(204).send();
  });

  // ---- Banners da home ----
  app.get('/banners', { preHandler: requirePermission('articles:read') }, async () => db.select().from(banners).orderBy(asc(banners.slot), desc(banners.priority)));

  app.post('/banners', { preHandler: requirePermission('commerce:write') }, async (req, reply) => {
    const input = parse(bannerInputSchema, req.body);
    const [row] = await db.insert(banners).values(input).returning();
    await audit(db, req.user, 'banner.create', 'banner', row!.id, { slot: input.slot, title: input.title, status: input.status });
    rebuild('banners');
    return reply.status(201).send(row);
  });

  app.put('/banners/:id', { preHandler: requirePermission('commerce:write') }, async (req) => {
    const id = idParam(req.params);
    const input = parse(bannerInputSchema, req.body);
    const [row] = await db.update(banners).set({ ...input, updatedAt: nowIso() }).where(eq(banners.id, id)).returning();
    if (!row) throw notFound('Banner');
    await audit(db, req.user, 'banner.update', 'banner', id, { slot: input.slot, title: input.title, status: input.status });
    rebuild('banners');
    return row;
  });

  app.delete('/banners/:id', { preHandler: requirePermission('commerce:write') }, async (req, reply) => {
    const id = idParam(req.params);
    await db.delete(banners).where(eq(banners.id, id));
    await audit(db, req.user, 'banner.delete', 'banner', id);
    rebuild('banners');
    return reply.status(204).send();
  });

  // ---- Canais (Telegram e WhatsApp) ----
  app.get('/channels', { preHandler: requirePermission('articles:read') }, async () => db.select().from(channels).orderBy(asc(channels.kind)));

  app.post('/channels', { preHandler: requirePermission('channels:write') }, async (req, reply) => {
    const input = parse(channelInputSchema, req.body);
    const [row] = await db.insert(channels).values({ ...input, description: input.description ?? null }).returning();
    await audit(db, req.user, 'channel.create', 'channel', row!.id, { kind: input.kind, active: input.active });
    rebuild('channels');
    return reply.status(201).send(row);
  });

  app.put('/channels/:id', { preHandler: requirePermission('channels:write') }, async (req) => {
    const id = idParam(req.params);
    const input = parse(channelInputSchema, req.body);
    const [row] = await db.update(channels).set({ ...input, description: input.description ?? null, updatedAt: nowIso() }).where(eq(channels.id, id)).returning();
    if (!row) throw notFound('Canal');
    await audit(db, req.user, 'channel.update', 'channel', id, { kind: input.kind, active: input.active });
    rebuild('channels');
    return row;
  });

  app.delete('/channels/:id', { preHandler: requirePermission('channels:write') }, async (req, reply) => {
    const id = idParam(req.params);
    await db.delete(channels).where(eq(channels.id, id));
    await audit(db, req.user, 'channel.delete', 'channel', id);
    rebuild('channels');
    return reply.status(204).send();
  });

  /**
   * Prepara o texto de uma mensagem para os canais. O envio é manual (copiar e colar),
   * pois não adicionamos pessoas nem disparamos mensagens em massa automaticamente.
   */
  app.post('/channels/compose', { preHandler: requirePermission('articles:read') }, async (req) => {
    const body = parse(z.object({ articleId: z.number().int().positive().optional(), productId: z.number().int().positive().optional(), siteUrl: z.string().url().optional() }), req.body);
    const site = (body.siteUrl ?? config.PUBLIC_API_URL).replace(/\/$/, '');
    if (body.articleId) {
      const [a] = await db.select().from(articles).where(eq(articles.id, body.articleId));
      if (!a) throw notFound('Artigo');
      if (a.approvalStatus !== 'published') throw badRequest('Só é possível divulgar artigos publicados.');
      const label = a.verificationStatus === 'confirmed' ? '✅ Confirmado' : a.verificationStatus === 'rumor' ? '⚠️ Rumor' : a.verificationStatus === 'theory' ? '💭 Teoria' : 'ℹ️ Reportado';
      const text = `${label} | *${a.title}*\n\n${a.summary}\n\nLeia com as fontes: ${site}/noticias/${a.slug}`;
      return { telegram: text, whatsapp: text };
    }
    if (body.productId) {
      const [row] = await db.select({ p: products, link: affiliateLinks }).from(products).innerJoin(affiliateLinks, eq(affiliateLinks.productId, products.id)).where(eq(products.id, body.productId));
      if (!row) throw notFound('Produto');
      const price = row.p.priceCents != null && isPriceFresh(row.p.priceCheckedAt)
        ? `${brl(row.p.priceCents)} (verificado em ${new Date(row.p.priceCheckedAt!).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })})`
        : 'Consulte o preço atual na loja';
      const text = `🛒 *${row.p.name}* — ${row.link.store}\n${price}\nDisponibilidade: ${AVAILABILITY_LABELS[row.p.availability]}\n\n${site}/go/product/${row.p.id}?p=channel\n\n_Link afiliado: podemos receber comissão por compras qualificadas, sem custo extra para você._`;
      return { telegram: text, whatsapp: text };
    }
    throw new HttpError(400, 'Informe articleId ou productId.');
  });
}
