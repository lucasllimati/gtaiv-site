import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDb, migrateDb, seed } from '@pgi/db';
import { exportSnapshot } from '../export.ts';

/**
 * Exporta o snapshot público para apps/web/public (ou OUT_DIR).
 * SITE_URL: endereço público do site (para sitemap/RSS).
 * MEDIA_PUBLIC_URL: base pública das mídias (ex.: domínio do R2). Padrão: PUBLIC_API_URL/media.
 */
const outDir = resolve(process.env.OUT_DIR ?? fileURLToPath(new URL('../../../web/public', import.meta.url)));
const siteUrl = process.env.SITE_URL ?? 'http://localhost:5173';
const mediaBase = (process.env.MEDIA_PUBLIC_URL ?? `${process.env.PUBLIC_API_URL ?? 'http://localhost:8787'}/media`).replace(/\/$/, '');

const { db, client } = createDb();
await migrateDb(db);
await seed(db);
const r = await exportSnapshot(db, { outDir, siteUrl, resolve: (key) => `${mediaBase}/${key}` });
console.log(`Snapshot exportado em ${outDir} (${r.articles} artigos).`);
client.close();
