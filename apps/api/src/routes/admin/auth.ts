import type { FastifyInstance } from 'fastify';
import { eq, sql } from 'drizzle-orm';
import { adminUsers, sessions } from '@pgi/db';
import { PERMISSIONS, hasPermission, loginSchema, type Permission } from '@pgi/shared';
import type { AppContext } from '../../app.ts';
import { HttpError, nowIso, parse } from '../../lib/http.ts';
import { DUMMY_HASH, verifyPassword } from '../../lib/password.ts';
import { clearSessionCookie, createSession, loadSessionUser, setSessionCookie } from '../../plugins/auth.ts';
import { audit } from '../../services/audit.ts';

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;

export async function authRoutes(app: FastifyInstance, ctx: AppContext): Promise<void> {
  const { db, config } = ctx;

  app.post(
    '/auth/login',
    { config: { rateLimit: { max: 10, timeWindow: '15 minutes' } } },
    async (req, reply) => {
      const { email, password } = parse(loginSchema, req.body);
      const [user] = await db.select().from(adminUsers).where(eq(adminUsers.email, email));
      const generic = new HttpError(401, 'E-mail ou senha incorretos.');

      if (!user) {
        await verifyPassword(password, DUMMY_HASH); // tempo constante
        throw generic;
      }
      if (user.lockedUntil && user.lockedUntil > nowIso()) {
        throw new HttpError(423, 'Conta temporariamente bloqueada por excesso de tentativas. Tente mais tarde.');
      }
      const ok = user.active && (await verifyPassword(password, user.passwordHash));
      if (!ok) {
        const failed = user.failedLogins + 1;
        await db
          .update(adminUsers)
          .set({
            failedLogins: failed >= MAX_FAILED ? 0 : failed,
            lockedUntil: failed >= MAX_FAILED ? new Date(Date.now() + LOCK_MINUTES * 60_000).toISOString() : user.lockedUntil,
          })
          .where(eq(adminUsers.id, user.id));
        await audit(db, null, 'auth.login_failed', 'admin_user', user.id, { locked: failed >= MAX_FAILED });
        throw generic;
      }

      await db.update(adminUsers).set({ failedLogins: 0, lockedUntil: null, lastLoginAt: nowIso() }).where(eq(adminUsers.id, user.id));
      const session = await createSession(db, config, user.id, req.headers['user-agent']);
      setSessionCookie(reply, config, session.token, session.expiresAt);
      await audit(db, { id: user.id, email: user.email, name: user.name, role: user.role, csrfToken: '', tokenHash: '' }, 'auth.login', 'admin_user', user.id);
      return { user: { id: user.id, email: user.email, name: user.name, role: user.role }, csrfToken: session.csrfToken, expiresAt: session.expiresAt };
    },
  );

  app.post('/auth/logout', async (req, reply) => {
    const user = await loadSessionUser(db, config, req);
    if (user) {
      const header = req.headers['x-csrf-token'];
      if (header !== user.csrfToken) throw new HttpError(403, 'Token CSRF inválido.');
      await db.delete(sessions).where(eq(sessions.tokenHash, user.tokenHash));
      await audit(db, user, 'auth.logout', 'admin_user', user.id);
    }
    clearSessionCookie(reply, config);
    return reply.status(204).send();
  });

  app.get('/auth/me', async (req, reply) => {
    const user = await loadSessionUser(db, config, req);
    if (!user) return reply.status(401).send({ error: 'Não autenticado.' });
    const permissions = (Object.keys(PERMISSIONS) as Permission[]).filter((p) => hasPermission(user.role, p));
    const [{ n } = { n: 0 }] = await db.select({ n: sql<number>`count(*)` }).from(adminUsers);
    return {
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      csrfToken: user.csrfToken,
      permissions,
      features: { ai: ctx.ai.enabled, mediaDriver: config.MEDIA_DRIVER, rebuild: Boolean(config.GITHUB_DISPATCH_TOKEN && config.GITHUB_REPOSITORY) },
      userCount: Number(n),
    };
  });
}
