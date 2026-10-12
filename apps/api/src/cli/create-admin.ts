import { parseArgs } from 'node:util';
import { eq } from 'drizzle-orm';
import { adminUsers, auditLogs, createDb, migrateDb } from '@pgi/db';
import { userCreateSchema } from '@pgi/shared';
import { hashPassword } from '../lib/password.ts';

/**
 * Cria (ou redefine a senha de) um usuário administrativo.
 * Uso: npm run admin:create -- --email voce@exemplo.com --name "Seu Nome" [--role admin]
 * A senha é lida de ADMIN_PASSWORD (para não ficar no histórico do terminal).
 */
const { values } = parseArgs({
  options: { email: { type: 'string' }, name: { type: 'string' }, role: { type: 'string', default: 'admin' }, reset: { type: 'boolean', default: false } },
});
const password = process.env.ADMIN_PASSWORD;
if (!password) {
  console.error('Defina a senha na variável ADMIN_PASSWORD (mínimo de 12 caracteres).');
  process.exit(1);
}
const parsed = userCreateSchema.safeParse({ email: values.email, name: values.name ?? 'Administrador', role: values.role, password });
if (!parsed.success) {
  console.error('Dados inválidos:', parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
  process.exit(1);
}
const input = parsed.data;
const { db, client } = createDb();
await migrateDb(db);
const [existing] = await db.select().from(adminUsers).where(eq(adminUsers.email, input.email));
if (existing && !values.reset) {
  console.error('Usuário já existe. Use --reset para redefinir a senha.');
  process.exit(1);
}
const passwordHash = await hashPassword(input.password);
if (existing) {
  await db.update(adminUsers).set({ passwordHash, role: input.role, active: true, failedLogins: 0, lockedUntil: null }).where(eq(adminUsers.id, existing.id));
} else {
  await db.insert(adminUsers).values({ email: input.email, name: input.name, role: input.role, passwordHash });
}
await db.insert(auditLogs).values({ action: existing ? 'user.reset_cli' : 'user.create_cli', entity: 'admin_user', entityId: input.email, details: { role: input.role } });
console.log(existing ? 'Senha redefinida.' : `Usuário ${input.email} criado com papel ${input.role}.`);
client.close();
