import type { FastifyInstance } from 'fastify';
import { desc, eq, sql } from 'drizzle-orm';
import { articles, contentAssets } from '@pgi/db';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import type { AppContext } from '../../app.ts';
import { badRequest, conflict, idParam, notFound, parse } from '../../lib/http.ts';
import { requirePermission } from '../../plugins/auth.ts';
import { audit } from '../../services/audit.ts';
import { imageSize, sniffMedia } from '../../services/storage.ts';

const LICENSES = ['original', 'oficial-com-permissao', 'cc-by', 'cc0', 'licenciado'] as const;

export async function mediaRoutes(app: FastifyInstance, ctx: AppContext): Promise<void> {
  const { db, storage } = ctx;

  app.get('/media', { preHandler: requirePermission('articles:read') }, async (req) => {
    const { kind } = req.query as { kind?: string };
    const rows = await db
      .select()
      .from(contentAssets)
      .where(kind && ['image', 'video', 'package', 'upload'].includes(kind) ? eq(contentAssets.kind, kind as 'image') : undefined)
      .orderBy(desc(contentAssets.createdAt))
      .limit(200);
    return rows.map((r) => ({ ...r, url: r.storageKey ? storage.url(r.storageKey) : null }));
  });

  /**
   * Upload de imagem ou vídeo. O tipo é validado pelos bytes do arquivo; o nome enviado é ignorado.
   * Campos: title, alt, license, credit, articleId (opcional).
   */
  app.post(
    '/media',
    { preHandler: requirePermission('media:write'), config: { rateLimit: { max: 30, timeWindow: '1 minute' } } },
    async (req, reply) => {
      const file = await req.file();
      if (!file) throw badRequest('Envie um arquivo no campo "file".');
      const buf = await file.toBuffer();
      if (file.file.truncated) throw badRequest('Arquivo maior que o limite permitido.');
      const kind = sniffMedia(buf);
      if (!kind) throw badRequest('Formato não suportado. Use PNG, JPEG, WebP, GIF, WebM ou MP4.');

      const field = (name: string) => {
        const f = file.fields[name];
        const v = f && !Array.isArray(f) && 'value' in f ? f.value : undefined;
        return typeof v === 'string' ? v : undefined;
      };
      const meta = parse(
        z.object({
          title: z.string().trim().min(1).max(160),
          alt: z.string().trim().max(300).optional(),
          license: z.enum(LICENSES).default('original'),
          credit: z.string().trim().max(160).optional(),
          articleId: z.coerce.number().int().positive().optional(),
        }),
        { title: field('title') ?? file.filename?.slice(0, 160) ?? 'arquivo', alt: field('alt'), license: field('license'), credit: field('credit'), articleId: field('articleId') || undefined },
      );
      if (meta.license !== 'original' && !meta.credit) throw badRequest('Informe o crédito/atribuição para materiais que não são originais.');
      if (meta.articleId) {
        const [a] = await db.select({ id: articles.id }).from(articles).where(eq(articles.id, meta.articleId));
        if (!a) throw notFound('Artigo');
      }

      const d = new Date();
      const key = `${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${randomBytes(12).toString('hex')}.${kind.ext}`;
      await storage.put(key, buf, kind.mime);
      const dims = kind.mime.startsWith('image/') ? imageSize(buf, kind.mime) : null;
      const [row] = await db
        .insert(contentAssets)
        .values({
          kind: kind.mime.startsWith('video/') ? 'video' : 'image',
          articleId: meta.articleId ?? null,
          title: meta.title,
          storageKey: key,
          mimeType: kind.mime,
          sizeBytes: buf.length,
          width: dims?.width ?? null,
          height: dims?.height ?? null,
          alt: meta.alt ?? null,
          license: meta.license,
          credit: meta.credit ?? null,
          createdBy: req.user!.id,
        })
        .returning();
      await audit(db, req.user, 'media.upload', 'content_asset', row!.id, { title: meta.title, mime: kind.mime, size: buf.length });
      return reply.status(201).send({ ...row, url: storage.url(key) });
    },
  );

  app.patch('/media/:id', { preHandler: requirePermission('media:write') }, async (req) => {
    const id = idParam(req.params);
    const body = parse(z.object({ title: z.string().trim().min(1).max(160), alt: z.string().trim().max(300).nullable(), credit: z.string().trim().max(160).nullable() }), req.body);
    const [row] = await db.update(contentAssets).set(body).where(eq(contentAssets.id, id)).returning();
    if (!row) throw notFound('Arquivo');
    await audit(db, req.user, 'media.update', 'content_asset', id, body);
    return row;
  });

  app.delete('/media/:id', { preHandler: requirePermission('media:write') }, async (req, reply) => {
    const id = idParam(req.params);
    const [row] = await db.select().from(contentAssets).where(eq(contentAssets.id, id));
    if (!row) throw notFound('Arquivo');
    const [used] = await db.select({ n: sql<number>`count(*)` }).from(articles).where(eq(articles.coverAssetId, id));
    if (Number(used?.n ?? 0) > 0) throw conflict('Este arquivo é capa de um artigo. Troque a capa antes de excluir.');
    if (row.storageKey) await storage.remove(row.storageKey);
    await db.delete(contentAssets).where(eq(contentAssets.id, id));
    await audit(db, req.user, 'media.delete', 'content_asset', id, { title: row.title });
    return reply.status(204).send();
  });
}
