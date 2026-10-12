import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient, type Client } from '@libsql/client';
import { drizzle, type LibSQLDatabase } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import * as schema from './schema.ts';

export type Db = LibSQLDatabase<typeof schema>;

const here = dirname(fileURLToPath(import.meta.url));
export const MIGRATIONS_DIR = resolve(here, '../drizzle');
const REPO_ROOT = resolve(here, '../../..');

/**
 * DATABASE_URL:
 *  - "file:.local/dev.db" (padrão) — SQLite local, relativo à raiz do repositório;
 *  - "libsql://<db>.turso.io" + DATABASE_AUTH_TOKEN — banco persistente gerenciado;
 *  - ":memory:" — testes.
 */
export function resolveDatabaseUrl(raw = process.env.DATABASE_URL): string {
  const url = raw?.trim() || 'file:.local/dev.db';
  if (url === ':memory:') return 'file::memory:';
  if (url.startsWith('file:') && !url.startsWith('file::memory:')) {
    const path = url.slice('file:'.length);
    const abs = resolve(REPO_ROOT, path);
    mkdirSync(dirname(abs), { recursive: true });
    return `file:${abs}`;
  }
  return url;
}

export interface DbHandle {
  db: Db;
  client: Client;
}

export function createDb(url?: string, authToken = process.env.DATABASE_AUTH_TOKEN): DbHandle {
  const client = createClient({ url: resolveDatabaseUrl(url), authToken: authToken || undefined });
  const db = drizzle(client, { schema });
  return { db, client };
}

export async function migrateDb(db: Db): Promise<void> {
  await db.run('PRAGMA foreign_keys = ON');
  await migrate(db, { migrationsFolder: MIGRATIONS_DIR });
}
