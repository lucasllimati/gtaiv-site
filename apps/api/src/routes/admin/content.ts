import type { FastifyInstance } from 'fastify';
import { and, asc, desc, eq, ne } from 'drizzle-orm';
import { discoveries, facts, guideEntries, settings } from '@pgi/db';
import {
  VERIFICATION_STATUSES,
  discoveryInputSchema,
  guideEntryInputSchema,
  httpUrl,
  settingsSchema,
  slugify,
} from '@pgi/shared';
import { z } from 'zod';
import type { AppContext } from '../../app.ts';
import { badRequest, conflict, idParam, notFound, nowIso, parse } from '../../lib/http.ts';
import { requirePermission } from '../../plugins/auth.ts';
import { audit } from '../../services/audit.ts';
import { requestSiteRebuild } from '../../services/dispatch.ts';

export async function contentRoutes(app: FastifyInstance, ctx: AppContext): Promise<void> {
  const { db, config } = ctx;
  const rebuild = (why: string) => void requestSiteRebuild(config, why);

  // ---- Guia do universo (história, personagens, locais, veículos, atividades, FAQ) ----
  app.get('/guide', { preHandler: requirePermission('articles:read') }, async () =>
    db.select().from(guideEntries).orderBy(asc(guideEntries.kind), asc(guideEntries.sortOrder)),
  );

  const saveGuide = async (input: z.infer<typeof guideEntryInputSchema>, id?: number) => {
    const slug = input.slug ?? slugify(input.title);
    if (!slug) throw badRequest('Título inválido para gerar slug.');
    const clash = await db
      .select({ id: guideEntries.id })
      .from(guideEntries)
      .where(and(eq(guideEntries.kind, input.kind), eq(guideEntries.slug, slug), id ? ne(guideEntries.id, id) : undefined));
    if (clash.length) throw conflict('Já existe um item com este slug nesta seção.');
    const values = { ...input, slug, eventDate: input.eventDate ?? null };
    if (id) {
      const [row] = await db.update(guideEntries).set({ ...values, updatedAt: nowIso() }).where(eq(guideEntries.id, id)).returning();
      if (!row) throw notFound('Item do guia');
      return row;
    }
    const [row] = await db.insert(guideEntries).values(values).returning();
    return row!;
  };

  app.post('/guide', { preHandler: requirePermission('articles:write') }, async (req, reply) => {
    const row = await saveGuide(parse(guideEntryInputSchema, req.body));
    await audit(db, req.user, 'guide.create', 'guide_entry', row.id, { title: row.title });
    if (row.published) rebuild('guide');
    return reply.status(201).send(row);
  });

  app.put('/guide/:id', { preHandler: requirePermission('articles:write') }, async (req) => {
    const id = idParam(req.params);
    const row = await saveGuide(parse(guideEntryInputSchema, req.body), id);
    await audit(db, req.user, 'guide.update', 'guide_entry', id, { title: row.title, published: row.published });
    rebuild('guide');
    return row;
  });

  app.delete('/guide/:id', { preHandler: requirePermission('articles:publish') }, async (req, reply) => {
    const id = idParam(req.params);
    await db.delete(guideEntries).where(eq(guideEntries.id, id));
    await audit(db, req.user, 'guide.delete', 'guide_entry', id);
    rebuild('guide');
    return reply.status(204).send();
  });

  // ---- Glitches, segredos e descobertas ----
  app.get('/discoveries', { preHandler: requirePermission('articles:read') }, async () =>
    db.select().from(discoveries).orderBy(desc(discoveries.updatedAt)),
  );

  app.post('/discoveries', { preHandler: requirePermission('articles:write') }, async (req, reply) => {
    const input = parse(discoveryInputSchema, req.body);
    if (input.published && input.verificationStatus === 'confirmed' && input.evidence.length === 0) {
      throw badRequest('Descobertas confirmadas precisam de pelo menos uma evidência.');
    }
    const slug = input.slug ?? slugify(input.title);
    const [clash] = await db.select({ id: discoveries.id }).from(discoveries).where(eq(discoveries.slug, slug));
    if (clash) throw conflict('Slug já utilizado.');
    const [row] = await db
      .insert(discoveries)
      .values({ ...input, slug, history: [{ at: nowIso(), by: req.user!.name, note: 'Registro criado.' }] })
      .returning();
    await audit(db, req.user, 'discovery.create', 'discovery', row!.id, { title: input.title });
    if (row!.published) rebuild('discovery');
    return reply.status(201).send(row);
  });

  app.put('/discoveries/:id', { preHandler: requirePermission('articles:write') }, async (req) => {
    const id = idParam(req.params);
    const body = parse(discoveryInputSchema.extend({ changeNote: z.string().trim().min(3).max(300) }), req.body);
    const { changeNote, ...input } = body;
    if (input.published && input.verificationStatus === 'confirmed' && input.evidence.length === 0) {
      throw badRequest('Descobertas confirmadas precisam de pelo menos uma evidência.');
    }
    const [current] = await db.select().from(discoveries).where(eq(discoveries.id, id));
    if (!current) throw notFound('Descoberta');
    const history = [...current.history, { at: nowIso(), by: req.user!.name, note: changeNote }].slice(-100);
    const [row] = await db
      .update(discoveries)
      .set({ ...input, slug: input.slug ?? current.slug, history, updatedAt: nowIso() })
      .where(eq(discoveries.id, id))
      .returning();
    await audit(db, req.user, 'discovery.update', 'discovery', id, { changeNote });
    rebuild('discovery');
    return row;
  });

  app.delete('/discoveries/:id', { preHandler: requirePermission('articles:publish') }, async (req, reply) => {
    const id = idParam(req.params);
    await db.delete(discoveries).where(eq(discoveries.id, id));
    await audit(db, req.user, 'discovery.delete', 'discovery', id);
    rebuild('discovery');
    return reply.status(204).send();
  });

  // ---- Fatos-chave da home ----
  app.get('/facts', { preHandler: requirePermission('articles:read') }, async () => db.select().from(facts));

  app.put('/facts/:key', { preHandler: requirePermission('articles:publish') }, async (req) => {
    const { key } = req.params as { key: string };
    if (!['releaseDate', 'platforms', 'developer', 'setting'].includes(key)) throw notFound('Fato');
    const input = parse(z.object({ value: z.string().trim().min(2).max(80), status: z.enum(VERIFICATION_STATUSES), sourceUrl: httpUrl }), req.body);
    await db
      .insert(facts)
      .values({ key, ...input })
      .onConflictDoUpdate({ target: facts.key, set: { ...input, updatedAt: nowIso() } });
    await audit(db, req.user, 'fact.update', 'fact', key, input);
    rebuild('facts');
    return { key, ...input };
  });

  // ---- Configurações gerais ----
  app.get('/settings', async () => {
    const rows = await db.select().from(settings);
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  });

  app.put('/settings', { preHandler: requirePermission('users:manage') }, async (req) => {
    const input = parse(settingsSchema, req.body);
    for (const [key, value] of Object.entries(input)) {
      await db.insert(settings).values({ key, value }).onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: nowIso() } });
    }
    await audit(db, req.user, 'settings.update', 'settings', null, input);
    rebuild('settings');
    return input;
  });
}
