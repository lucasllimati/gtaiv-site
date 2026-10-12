import { auditLogs, type Db } from '@pgi/db';
import type { SessionUser } from '../plugins/auth.ts';

const SECRET_KEYS = /password|token|secret|hash|authorization|cookie/i;

/** Remove campos sensíveis antes de gravar detalhes no histórico. */
export function redact(value: unknown, depth = 0): unknown {
  if (depth > 4 || value == null) return value;
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => redact(v, depth + 1));
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SECRET_KEYS.test(k) ? '[omitido]' : redact(v, depth + 1);
    }
    return out;
  }
  if (typeof value === 'string' && value.length > 500) return `${value.slice(0, 500)}…`;
  return value;
}

export async function audit(
  db: Db,
  user: SessionUser | null,
  action: string,
  entity: string,
  entityId: string | number | null,
  details?: Record<string, unknown>,
): Promise<void> {
  await db.insert(auditLogs).values({
    userId: user?.id ?? null,
    userEmail: user?.email ?? null,
    action,
    entity,
    entityId: entityId == null ? null : String(entityId),
    details: details ? (redact(details) as Record<string, unknown>) : null,
  });
}
