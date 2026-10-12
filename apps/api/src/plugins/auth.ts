import type { FastifyReply, FastifyRequest, preHandlerAsyncHookHandler } from 'fastify';
import { and, eq, gt, lt } from 'drizzle-orm';
import { adminUsers, sessions, type Db } from '@pgi/db';
import { hasPermission, type Permission, type Role } from '@pgi/shared';
import type { Config } from '../config.ts';
import { HttpError, forbidden } from '../lib/http.ts';
import { randomToken, sha256 } from '../lib/password.ts';

export interface SessionUser {
  id: number;
  email: string;
  name: string;
  role: Role;
  csrfToken: string;
  tokenHash: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    user: SessionUser | null;
  }
}

export function cookieName(cfg: Config): string {
  // O prefixo __Host- impede que subdomínios sobrescrevam o cookie (exige Secure e Path=/).
  return cfg.cookieSecure ? '__Host-pgi_session' : 'pgi_session';
}

export async function createSession(db: Db, cfg: Config, userId: number, userAgent: string | undefined) {
  const token = randomToken();
  const csrfToken = randomToken(24);
  const expiresAt = new Date(Date.now() + cfg.SESSION_TTL_HOURS * 3_600_000).toISOString();
  await db.insert(sessions).values({ tokenHash: sha256(token), userId, csrfToken, expiresAt, userAgent: userAgent?.slice(0, 200) ?? null });
  // Limpeza oportunista de sessões expiradas.
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date().toISOString()));
  return { token, csrfToken, expiresAt };
}

export function setSessionCookie(reply: FastifyReply, cfg: Config, token: string, expiresAt: string): void {
  reply.setCookie(cookieName(cfg), token, {
    httpOnly: true,
    secure: cfg.cookieSecure,
    sameSite: 'strict',
    path: '/',
    expires: new Date(expiresAt),
  });
}

export function clearSessionCookie(reply: FastifyReply, cfg: Config): void {
  reply.clearCookie(cookieName(cfg), { path: '/', secure: cfg.cookieSecure, sameSite: 'strict', httpOnly: true });
}

export async function loadSessionUser(db: Db, cfg: Config, req: FastifyRequest): Promise<SessionUser | null> {
  const token = req.cookies[cookieName(cfg)];
  if (!token) return null;
  const tokenHash = sha256(token);
  const [row] = await db
    .select({ s: sessions, u: adminUsers })
    .from(sessions)
    .innerJoin(adminUsers, eq(adminUsers.id, sessions.userId))
    .where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, new Date().toISOString())));
  if (!row || !row.u.active) return null;
  return { id: row.u.id, email: row.u.email, name: row.u.name, role: row.u.role, csrfToken: row.s.csrfToken, tokenHash };
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Exige sessão válida. Em métodos que alteram estado, exige também o cabeçalho
 * X-CSRF-Token igual ao token da sessão (além do cookie SameSite=Strict).
 */
export function requireAuth(db: Db, cfg: Config): preHandlerAsyncHookHandler {
  return async (req) => {
    const user = await loadSessionUser(db, cfg, req);
    if (!user) throw new HttpError(401, 'Sessão expirada ou inexistente. Faça login novamente.');
    if (!SAFE_METHODS.has(req.method)) {
      const header = req.headers['x-csrf-token'];
      if (typeof header !== 'string' || header !== user.csrfToken) throw new HttpError(403, 'Token CSRF inválido.');
    }
    req.user = user;
  };
}

export function requirePermission(permission: Permission): preHandlerAsyncHookHandler {
  return async (req) => {
    if (!req.user) throw new HttpError(401, 'Não autenticado.');
    if (!hasPermission(req.user.role, permission)) throw forbidden();
  };
}
