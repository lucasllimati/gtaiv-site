import type { FastifyInstance } from 'fastify';
import { and, desc, eq, gte, lt, ne, sql } from 'drizzle-orm';
import {
  adminUsers,
  articles,
  auditLogs,
  banners,
  channels,
  clickEvents,
  pageViewsDaily,
  pipelineRuns,
  products,
  sessions,
  sourceItems,
  sources,
} from '@pgi/db';
import { listQuerySchema, userCreateSchema, userUpdateSchema } from '@pgi/shared';
import type { AppContext } from '../../app.ts';
import { HttpError, badRequest, conflict, idParam, notFound, nowIso, parse } from '../../lib/http.ts';
import { hashPassword } from '../../lib/password.ts';
import { requirePermission } from '../../plugins/auth.ts';
import { audit } from '../../services/audit.ts';
import { requestSiteRebuild } from '../../services/dispatch.ts';

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

export async function systemRoutes(app: FastifyInstance, ctx: AppContext): Promise<void> {
  const { db, config, ai } = ctx;

  app.get('/dashboard', { preHandler: requirePermission('metrics:read') }, async () => {
    const count = async (q: Promise<{ n: number }[]>) => Number((await q)[0]?.n ?? 0);
    const n = sql<number>`count(*)`;
    const [byApproval, queue, failingSources, lastRuns, views7, clicks7, aiUsed] = await Promise.all([
      db.select({ status: articles.approvalStatus, n }).from(articles).groupBy(articles.approvalStatus),
      count(db.select({ n }).from(sourceItems).where(eq(sourceItems.status, 'new'))),
      db.select({ id: sources.id, name: sources.name, lastError: sources.lastError, consecutiveFailures: sources.consecutiveFailures, lastRunAt: sources.lastRunAt }).from(sources).where(and(eq(sources.enabled, true), eq(sources.lastStatus, 'error'))),
      db.select().from(pipelineRuns).orderBy(desc(pipelineRuns.startedAt)).limit(5),
      count(db.select({ n: sql<number>`coalesce(sum(${pageViewsDaily.views}),0)` }).from(pageViewsDaily).where(gte(pageViewsDaily.day, daysAgo(7).slice(0, 10)))),
      count(db.select({ n }).from(clickEvents).where(gte(clickEvents.createdAt, daysAgo(7)))),
      ai.usedToday(),
    ]);
    const lastRun = lastRuns[0];
    const alerts: string[] = [];
    if (!lastRun) alerts.push('A coleta de fontes ainda não foi executada.');
    else if (Date.now() - Date.parse(lastRun.startedAt) > 6 * 3_600_000) alerts.push('A última coleta tem mais de 6 horas. Verifique o agendamento.');
    if (lastRun?.status === 'failed') alerts.push('A última coleta falhou.');
    for (const s of failingSources) alerts.push(`Fonte com erro: ${s.name} (${s.consecutiveFailures} falha(s) seguida(s)).`);
    const [activeBanners, activeChannels] = await Promise.all([
      count(db.select({ n }).from(banners).where(eq(banners.status, 'active'))),
      count(db.select({ n }).from(channels).where(eq(channels.active, true))),
    ]);
    if (activeBanners === 0) alerts.push('Nenhum banner afiliado ativo: a home exibe o espaço reservado.');
    if (activeChannels === 0) alerts.push('Nenhum canal de Telegram/WhatsApp configurado.');
    return {
      articles: Object.fromEntries(byApproval.map((r) => [r.status, Number(r.n)])),
      queue,
      failingSources,
      lastRuns,
      views7,
      clicks7,
      ai: { enabled: ai.enabled, usedToday: aiUsed, dailyLimit: config.AI_DAILY_LIMIT },
      alerts,
    };
  });

  app.get('/metrics', { preHandler: requirePermission('metrics:read') }, async (req) => {
    const days = Math.min(Math.max(Number((req.query as { days?: string }).days ?? 30) || 30, 1), 365);
    const since = daysAgo(days);
    const [viewsByDay, topPages, clicksByTarget, clicksByPlacement] = await Promise.all([
      db.select({ day: pageViewsDaily.day, views: sql<number>`sum(${pageViewsDaily.views})` }).from(pageViewsDaily).where(gte(pageViewsDaily.day, since.slice(0, 10))).groupBy(pageViewsDaily.day).orderBy(pageViewsDaily.day),
      db.select({ path: pageViewsDaily.path, views: sql<number>`sum(${pageViewsDaily.views})` }).from(pageViewsDaily).where(gte(pageViewsDaily.day, since.slice(0, 10))).groupBy(pageViewsDaily.path).orderBy(desc(sql`sum(${pageViewsDaily.views})`)).limit(20),
      db.select({ targetType: clickEvents.targetType, targetId: clickEvents.targetId, clicks: sql<number>`count(*)` }).from(clickEvents).where(gte(clickEvents.createdAt, since)).groupBy(clickEvents.targetType, clickEvents.targetId).orderBy(desc(sql`count(*)`)).limit(50),
      db.select({ placement: clickEvents.placement, clicks: sql<number>`count(*)` }).from(clickEvents).where(gte(clickEvents.createdAt, since)).groupBy(clickEvents.placement).orderBy(desc(sql`count(*)`)),
    ]);
    // Nomes legíveis para os alvos de clique.
    const [bannerNames, productNames, channelNames] = await Promise.all([
      db.select({ id: banners.id, name: banners.title }).from(banners),
      db.select({ id: products.id, name: products.name }).from(products),
      db.select({ id: channels.id, name: channels.label }).from(channels),
    ]);
    const names = { banner: new Map(bannerNames.map((b) => [b.id, b.name])), product: new Map(productNames.map((p) => [p.id, p.name])), channel: new Map(channelNames.map((c) => [c.id, c.name])) };
    return {
      days,
      viewsByDay: viewsByDay.map((r) => ({ day: r.day, views: Number(r.views) })),
      topPages: topPages.map((r) => ({ path: r.path, views: Number(r.views) })),
      clicksByTarget: clicksByTarget.map((r) => ({ ...r, clicks: Number(r.clicks), name: names[r.targetType].get(r.targetId) ?? `#${r.targetId} (removido)` })),
      clicksByPlacement: clicksByPlacement.map((r) => ({ placement: r.placement, clicks: Number(r.clicks) })),
    };
  });

  app.get('/audit', { preHandler: requirePermission('audit:read') }, async (req) => {
    const q = parse(listQuerySchema, req.query);
    const rows = await db.select().from(auditLogs).orderBy(desc(auditLogs.id)).limit(q.pageSize).offset((q.page - 1) * q.pageSize);
    const [count] = await db.select({ n: sql<number>`count(*)` }).from(auditLogs);
    return { items: rows, total: Number(count?.n ?? 0), page: q.page, pageSize: q.pageSize };
  });

  // ---- Usuários administrativos ----
  app.get('/users', { preHandler: requirePermission('users:manage') }, async () =>
    db.select({ id: adminUsers.id, email: adminUsers.email, name: adminUsers.name, role: adminUsers.role, active: adminUsers.active, lastLoginAt: adminUsers.lastLoginAt, createdAt: adminUsers.createdAt }).from(adminUsers).orderBy(adminUsers.id),
  );

  app.post('/users', { preHandler: requirePermission('users:manage') }, async (req, reply) => {
    const input = parse(userCreateSchema, req.body);
    const [exists] = await db.select({ id: adminUsers.id }).from(adminUsers).where(eq(adminUsers.email, input.email));
    if (exists) throw conflict('Já existe um usuário com este e-mail.');
    const [row] = await db.insert(adminUsers).values({ email: input.email, name: input.name, role: input.role, passwordHash: await hashPassword(input.password) }).returning({ id: adminUsers.id });
    await audit(db, req.user, 'user.create', 'admin_user', row!.id, { email: input.email, role: input.role });
    return reply.status(201).send({ id: row!.id });
  });

  app.put('/users/:id', { preHandler: requirePermission('users:manage') }, async (req) => {
    const id = idParam(req.params);
    const input = parse(userUpdateSchema, req.body);
    if (id === req.user!.id && (input.active === false || (input.role && input.role !== 'admin'))) {
      throw badRequest('Você não pode desativar ou rebaixar o próprio usuário.');
    }
    if (input.active === false || (input.role && input.role !== 'admin')) {
      const [others] = await db.select({ n: sql<number>`count(*)` }).from(adminUsers).where(and(eq(adminUsers.role, 'admin'), eq(adminUsers.active, true), ne(adminUsers.id, id)));
      if (Number(others?.n ?? 0) === 0) throw badRequest('É preciso manter pelo menos um administrador ativo.');
    }
    const { password, ...rest } = input;
    const [row] = await db
      .update(adminUsers)
      .set({ ...rest, ...(password ? { passwordHash: await hashPassword(password) } : {}), updatedAt: nowIso() })
      .where(eq(adminUsers.id, id))
      .returning({ id: adminUsers.id });
    if (!row) throw notFound('Usuário');
    // Alterar senha, papel ou status encerra as sessões abertas desse usuário.
    if (password || rest.role || rest.active === false) await db.delete(sessions).where(eq(sessions.userId, id));
    await audit(db, req.user, 'user.update', 'admin_user', id, { ...rest, passwordChanged: Boolean(password) });
    return { ok: true };
  });

  // ---- Manutenção ----
  app.post('/maintenance/retention', { preHandler: requirePermission('users:manage') }, async (req) => {
    const cutoff = daysAgo(config.CLICK_RETENTION_DAYS);
    const removed = await db.delete(clickEvents).where(lt(clickEvents.createdAt, cutoff)).returning({ id: clickEvents.id });
    await db.delete(sessions).where(lt(sessions.expiresAt, nowIso()));
    await audit(db, req.user, 'maintenance.retention', 'click_events', null, { removed: removed.length, cutoff });
    return { removedClicks: removed.length, cutoff };
  });

  app.post('/publish/rebuild', { preHandler: requirePermission('articles:publish') }, async (req) => {
    const ok = await requestSiteRebuild(config, `manual by ${req.user!.email}`);
    if (!ok) throw new HttpError(503, 'Republicação automática não configurada (GITHUB_DISPATCH_TOKEN/GITHUB_REPOSITORY) ou o GitHub recusou o pedido.');
    await audit(db, req.user, 'site.rebuild', 'site', null);
    return { ok: true };
  });
}
