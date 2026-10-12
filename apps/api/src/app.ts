import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import Fastify, { type FastifyInstance } from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import type { Db } from '@pgi/db';
import type { Config } from './config.ts';
import { HttpError } from './lib/http.ts';
import { requireAuth } from './plugins/auth.ts';
import { AiService } from './services/ai.ts';
import { REPO_ROOT, createStorage, type MediaStorage } from './services/storage.ts';
import { publicRoutes } from './routes/public.ts';
import { authRoutes } from './routes/admin/auth.ts';
import { articleRoutes } from './routes/admin/articles.ts';
import { sourceRoutes } from './routes/admin/sources.ts';
import { contentRoutes } from './routes/admin/content.ts';
import { commerceRoutes } from './routes/admin/commerce.ts';
import { mediaRoutes } from './routes/admin/media.ts';
import { studioRoutes } from './routes/admin/studio.ts';
import { systemRoutes } from './routes/admin/system.ts';

export interface AppDeps {
  db: Db;
  config: Config;
  storage?: MediaStorage;
  ai?: AiService;
  /** Executa a coleta de fontes. Injetado para permitir testes sem rede. */
  runCollect?: (trigger: string, sourceId?: number) => Promise<{ runId: number }>;
}

export interface AppContext {
  db: Db;
  config: Config;
  storage: MediaStorage;
  ai: AiService;
  runCollect?: AppDeps['runCollect'];
}

export async function buildApp(deps: AppDeps): Promise<FastifyInstance> {
  const { db, config } = deps;
  const ctx: AppContext = {
    db,
    config,
    storage: deps.storage ?? createStorage(config),
    ai: deps.ai ?? new AiService(config, db),
    runCollect: deps.runCollect,
  };

  const app = Fastify({
    logger:
      config.NODE_ENV === 'test'
        ? false
        : {
            level: config.LOG_LEVEL,
            // Nunca registrar cookies, tokens ou senhas.
            redact: ['req.headers.cookie', 'req.headers.authorization', 'req.headers["x-csrf-token"]', 'res.headers["set-cookie"]'],
          },
    trustProxy: true,
    bodyLimit: 1_048_576,
  });

  app.decorateRequest('user', null);

  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
        mediaSrc: ["'self'", 'blob:', 'https:'],
        styleSrc: ["'self'", "'unsafe-inline'"],
        fontSrc: ["'self'", 'data:'],
        scriptSrc: ["'self'"],
        connectSrc: ["'self'"],
        frameAncestors: ["'none'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  });
  await app.register(cors, {
    origin: (origin, cb) => cb(null, !origin || config.corsOrigins.includes(origin)),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  });
  await app.register(cookie);
  await app.register(rateLimit, { global: true, max: 300, timeWindow: '1 minute' });
  await app.register(multipart, { limits: { fileSize: config.MEDIA_MAX_MB * 1_048_576, files: 1, fields: 10 } });

  app.setErrorHandler((err: Error & { statusCode?: number; validation?: unknown }, req, reply) => {
    if (err instanceof HttpError) {
      return reply.status(err.statusCode).send({ error: err.message, details: err.details });
    }
    const status = err.statusCode && err.statusCode >= 400 && err.statusCode < 600 ? err.statusCode : 500;
    if (status >= 500) req.log.error({ err }, 'erro interno');
    return reply.status(status).send({ error: status >= 500 ? 'Erro interno. Tente novamente.' : err.message });
  });

  app.get('/api/health', async () => ({ ok: true, time: new Date().toISOString() }));

  await app.register(async (pub) => publicRoutes(pub, ctx));

  await app.register(
    async (admin) => {
      await authRoutes(admin, ctx);
      await admin.register(async (secured) => {
        secured.addHook('preHandler', requireAuth(db, config));
        await articleRoutes(secured, ctx);
        await sourceRoutes(secured, ctx);
        await contentRoutes(secured, ctx);
        await commerceRoutes(secured, ctx);
        await mediaRoutes(secured, ctx);
        await studioRoutes(secured, ctx);
        await systemRoutes(secured, ctx);
      });
    },
    { prefix: '/api/admin' },
  );

  // Mídia local (em produção recomenda-se R2, que serve os arquivos diretamente).
  if (ctx.storage.read) {
    const read = ctx.storage.read.bind(ctx.storage);
    app.get('/media/*', async (req, reply) => {
      const key = (req.params as { '*': string })['*'];
      if (!/^[a-z0-9/_.-]+$/i.test(key) || key.includes('..')) return reply.status(400).send();
      try {
        const buf = await read(key);
        const ext = key.split('.').pop()?.toLowerCase();
        const types: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', webm: 'video/webm', mp4: 'video/mp4' };
        return reply.header('Cache-Control', 'public, max-age=86400').type(types[ext ?? ''] ?? 'application/octet-stream').send(buf);
      } catch {
        return reply.status(404).send({ error: 'Arquivo não encontrado.' });
      }
    });
  }

  // Quando o build do frontend estiver disponível, a API serve o site e o painel na mesma origem
  // (necessário para o cookie de sessão SameSite=Strict funcionar).
  const webDist = config.WEB_DIST_DIR ? resolve(REPO_ROOT, config.WEB_DIST_DIR) : null;
  if (webDist && existsSync(resolve(webDist, 'index.html'))) {
    await app.register(fastifyStatic, { root: webDist, wildcard: false, index: false });
    app.get('/*', async (req, reply) => {
      const path = (req.params as { '*': string })['*'];
      if (path.startsWith('api/')) return reply.status(404).send({ error: 'Rota inexistente.' });
      const candidate = resolve(webDist, path);
      if (!candidate.startsWith(webDist)) return reply.status(400).send();
      if (path && path.includes('.') && existsSync(candidate)) {
        const immutable = path.startsWith('assets/');
        return reply.header('Cache-Control', immutable ? 'public, max-age=31536000, immutable' : 'public, max-age=300').sendFile(path);
      }
      // Página pré-renderizada da rota (SEO), quando existir; senão o shell da SPA,
      // que resolve a rota no navegador (inclui artigos publicados depois do build).
      const clean = path.replace(/\/+$/, '');
      const prerendered = `${clean}/index.html`;
      const file = clean && existsSync(resolve(webDist, prerendered)) ? prerendered : 'index.html';
      return reply.header('Cache-Control', 'no-cache').sendFile(file);
    });
  }

  return app;
}
