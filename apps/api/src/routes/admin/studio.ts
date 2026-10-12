import type { FastifyInstance } from 'fastify';
import { and, desc, eq } from 'drizzle-orm';
import { channels, contentAssets } from '@pgi/db';
import { CHANNEL_KINDS } from '@pgi/shared';
import type { AppContext } from '../../app.ts';
import { badRequest, idParam } from '../../lib/http.ts';
import { requirePermission } from '../../plugins/auth.ts';
import { audit } from '../../services/audit.ts';
import { loadArticleDetail } from './articles.ts';

/**
 * Estúdio de conteúdo: gera o pacote textual (títulos, roteiros, legendas, cenas).
 * As artes (1:1, 4:5, 9:16, 16:9) e o vídeo curto são renderizados no navegador do editor,
 * sem custo de servidor, e podem ser enviados de volta para a biblioteca de mídia.
 */
export async function studioRoutes(app: FastifyInstance, ctx: AppContext): Promise<void> {
  const { db, ai } = ctx;

  app.get('/studio/packages', { preHandler: requirePermission('articles:read') }, async (req) => {
    const { articleId } = req.query as { articleId?: string };
    const id = articleId ? Number(articleId) : undefined;
    return db
      .select()
      .from(contentAssets)
      .where(and(eq(contentAssets.kind, 'package'), id ? eq(contentAssets.articleId, id) : undefined))
      .orderBy(desc(contentAssets.createdAt))
      .limit(50);
  });

  app.post(
    '/studio/articles/:id/package',
    { preHandler: requirePermission('media:write'), config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (req, reply) => {
      const id = idParam(req.params);
      const article = await loadArticleDetail(db, id);
      if (article.approvalStatus !== 'approved' && article.approvalStatus !== 'published') {
        throw badRequest('O estúdio só trabalha com artigos aprovados ou publicados.');
      }
      const active = await db.select({ kind: channels.kind }).from(channels).where(eq(channels.active, true));
      const channelNames = CHANNEL_KINDS.filter((k) => active.some((c) => c.kind === k)).map((k) => (k === 'telegram' ? 'Telegram' : 'WhatsApp'));
      const pkg = await ai.contentPackage({
        title: article.title,
        summary: article.summary,
        body: article.body,
        verificationStatus: article.verificationStatus,
        sources: article.sources.map((s) => ({ title: s.title, publisher: s.publisher, url: s.url })),
        channelNames,
      });
      const [row] = await db
        .insert(contentAssets)
        .values({
          kind: 'package',
          articleId: id,
          title: `Pacote social — ${article.title}`.slice(0, 160),
          license: 'original',
          data: pkg as unknown as Record<string, unknown>,
          createdBy: req.user!.id,
        })
        .returning();
      await audit(db, req.user, 'studio.package', 'content_asset', row!.id, { articleId: id, generator: pkg.generator });
      return reply.status(201).send(row);
    },
  );
}
