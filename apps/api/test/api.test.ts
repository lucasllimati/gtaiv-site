import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { adminUsers, auditLogs, createDb, migrateDb, seed, sourceItems, sources, type Db } from '@pgi/db';
import type { PublicSiteData } from '@pgi/shared';
import { buildApp } from '../src/app.ts';
import { loadConfig } from '../src/config.ts';
import { hashPassword } from '../src/lib/password.ts';
import type { MediaStorage } from '../src/services/storage.ts';

const PASSWORD = 'senha-de-teste-123';
let app: FastifyInstance;
let db: Db;

const memoryStorage = (): MediaStorage => {
  const files = new Map<string, Buffer>();
  return {
    put: async (k, b) => void files.set(k, b),
    remove: async (k) => void files.delete(k),
    url: (k) => `https://media.test/${k}`,
  };
};

interface Session {
  cookie: string;
  csrf: string;
}

async function login(email: string, password = PASSWORD): Promise<Session> {
  const res = await app.inject({ method: 'POST', url: '/api/admin/auth/login', payload: { email, password } });
  expect(res.statusCode).toBe(200);
  const raw = res.headers['set-cookie'];
  const cookie = (Array.isArray(raw) ? raw[0] : raw)!.split(';')[0]!;
  return { cookie, csrf: res.json().csrfToken };
}

function as(s: Session, method: 'GET' | 'POST' | 'PUT' | 'DELETE', url: string, payload?: unknown) {
  return app.inject({ method, url: `/api/admin${url}`, payload: payload as object, headers: { cookie: s.cookie, 'x-csrf-token': s.csrf } });
}

let admin: Session;
let editor: Session;

beforeAll(async () => {
  ({ db } = createDb(':memory:'));
  await migrateDb(db);
  await seed(db);
  const hash = await hashPassword(PASSWORD);
  await db.insert(adminUsers).values([
    { email: 'admin@test.dev', name: 'Admin Teste', role: 'admin', passwordHash: hash },
    { email: 'editor@test.dev', name: 'Editor Teste', role: 'editor', passwordHash: hash },
    { email: 'lock@test.dev', name: 'Lock', role: 'editor', passwordHash: hash },
  ]);
  const config = loadConfig({ NODE_ENV: 'test', CORS_ORIGINS: 'http://localhost:5173', LOG_LEVEL: 'silent' });
  app = await buildApp({ db, config, storage: memoryStorage(), runCollect: async () => ({ runId: 0 }) });
  admin = await login('admin@test.dev');
  editor = await login('editor@test.dev');
});

afterAll(async () => {
  await app?.close();
});

describe('API pública', () => {
  it('retorna os dados do site com o conteúdo-base', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/public/site' });
    expect(res.statusCode).toBe(200);
    const data = res.json() as PublicSiteData;
    expect(data.articles.length).toBeGreaterThanOrEqual(5);
    expect(data.facts.releaseDate?.value).toBe('19 de novembro de 2026');
    expect(data.banners).toEqual([]);
    expect(data.channels).toEqual([]);
  });
  it('404 para artigo inexistente ou slug inválido', async () => {
    expect((await app.inject({ method: 'GET', url: '/api/public/articles/nao-existe' })).statusCode).toBe(404);
    expect((await app.inject({ method: 'GET', url: '/api/public/articles/..%2F..%2Fetc' })).statusCode).toBe(404);
  });
  it('envia cabeçalhos de segurança', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.headers['content-security-policy']).toContain("default-src 'self'");
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });
  it('CORS só libera origens configuradas', async () => {
    const ok = await app.inject({ method: 'GET', url: '/api/health', headers: { origin: 'http://localhost:5173' } });
    expect(ok.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    const bad = await app.inject({ method: 'GET', url: '/api/health', headers: { origin: 'https://evil.test' } });
    expect(bad.headers['access-control-allow-origin']).toBeUndefined();
  });
  it('contabiliza visitas agregadas', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/public/view', payload: { path: '/noticias' } });
    expect(res.statusCode).toBe(204);
  });
});

describe('Autenticação e autorização', () => {
  it('rotas administrativas exigem sessão', async () => {
    expect((await app.inject({ method: 'GET', url: '/api/admin/articles' })).statusCode).toBe(401);
    expect((await app.inject({ method: 'GET', url: '/api/admin/dashboard' })).statusCode).toBe(401);
  });
  it('senha errada retorna mensagem genérica e bloqueia após 5 tentativas', async () => {
    for (let i = 0; i < 5; i++) {
      const r = await app.inject({ method: 'POST', url: '/api/admin/auth/login', payload: { email: 'lock@test.dev', password: 'errada-errada-1' } });
      expect(r.statusCode).toBe(401);
      expect(r.json().error).toBe('E-mail ou senha incorretos.');
    }
    const locked = await app.inject({ method: 'POST', url: '/api/admin/auth/login', payload: { email: 'lock@test.dev', password: PASSWORD } });
    expect(locked.statusCode).toBe(423);
  });
  it('cookie de sessão é httpOnly e SameSite=Strict', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/admin/auth/login', payload: { email: 'admin@test.dev', password: PASSWORD } });
    const c = String(res.headers['set-cookie']);
    expect(c).toContain('HttpOnly');
    expect(c).toContain('SameSite=Strict');
  });
  it('POST sem token CSRF é recusado', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/admin/articles', headers: { cookie: admin.cookie }, payload: {} });
    expect(res.statusCode).toBe(403);
  });
  it('/me informa permissões por papel', async () => {
    const res = await as(editor, 'GET', '/auth/me');
    expect(res.json().permissions).toContain('articles:approve');
    expect(res.json().permissions).not.toContain('articles:publish');
  });
  it('editor não gerencia usuários nem comércio', async () => {
    expect((await as(editor, 'GET', '/users')).statusCode).toBe(403);
    expect((await as(editor, 'POST', '/banners', {})).statusCode).toBe(403);
  });
  it('não grava senhas no histórico', async () => {
    await as(admin, 'POST', '/users', { email: 'novo@test.dev', name: 'Novo', role: 'viewer', password: 'outra-senha-segura' });
    const logs = await db.select().from(auditLogs).where(eq(auditLogs.action, 'user.create'));
    expect(JSON.stringify(logs)).not.toContain('outra-senha-segura');
  });
});

const articlePayload = {
  title: 'Rockstar divulga novas informações de GTA VI',
  summary: 'Resumo de teste com tamanho suficiente para passar na validação.',
  body: 'Corpo do artigo de teste com texto original e contexto suficiente para a validação mínima.',
  categorySlug: 'noticias',
  verificationStatus: 'reported',
  authorName: 'Editor Teste',
  sources: [{ url: 'https://example.com/fonte', title: 'Fonte', publisher: 'Exemplo', isPrimary: true }],
  claims: [{ text: 'Afirmação de teste', status: 'reported', sourceUrl: 'https://example.com/fonte' }],
};

describe('Fluxo editorial', () => {
  let id: number;
  it('editor cria rascunho', async () => {
    const res = await as(editor, 'POST', '/articles', articlePayload);
    expect(res.statusCode).toBe(201);
    id = res.json().id;
    expect(res.json().approvalStatus).toBe('draft');
    expect(res.json().slug).toBe('rockstar-divulga-novas-informacoes-de-gta-vi');
  });
  it('não pula etapas: rascunho não vai direto para publicado', async () => {
    const res = await as(admin, 'POST', `/articles/${id}/transition`, { to: 'published' });
    expect(res.statusCode).toBe(400);
  });
  it('editor envia para revisão e aprova, mas não publica', async () => {
    expect((await as(editor, 'POST', `/articles/${id}/transition`, { to: 'in_review' })).statusCode).toBe(200);
    const approved = await as(editor, 'POST', `/articles/${id}/transition`, { to: 'approved' });
    expect(approved.statusCode).toBe(200);
    expect(approved.json().approvedByName).toBe('Editor Teste');
    expect(approved.json().approvedAt).toBeTruthy();
    expect((await as(editor, 'POST', `/articles/${id}/transition`, { to: 'published' })).statusCode).toBe(403);
  });
  it('artigo não publicado não aparece no site', async () => {
    expect((await app.inject({ method: 'GET', url: '/api/public/articles/rockstar-divulga-novas-informacoes-de-gta-vi' })).statusCode).toBe(404);
  });
  it('admin publica e o artigo aparece no site com fontes e afirmações', async () => {
    expect((await as(admin, 'POST', `/articles/${id}/transition`, { to: 'published' })).statusCode).toBe(200);
    const pub = await app.inject({ method: 'GET', url: '/api/public/articles/rockstar-divulga-novas-informacoes-de-gta-vi' });
    expect(pub.statusCode).toBe(200);
    expect(pub.json().sources).toHaveLength(1);
    expect(pub.json().claims[0].status).toBe('reported');
  });
  it('aprovação exige fonte', async () => {
    const res = await as(editor, 'POST', '/articles', { ...articlePayload, title: 'Artigo sem fonte para testar a regra', sources: [] });
    const nid = res.json().id;
    await as(editor, 'POST', `/articles/${nid}/transition`, { to: 'in_review' });
    const r = await as(editor, 'POST', `/articles/${nid}/transition`, { to: 'approved' });
    expect(r.statusCode).toBe(400);
  });
});

describe('Fila e rascunhos a partir de fontes', () => {
  it('gera rascunho sem IA, marcado para reescrita, e não permite aprovar sem reescrever', async () => {
    const [src] = await db.select().from(sources).where(eq(sources.name, 'IGN'));
    const [item] = await db
      .insert(sourceItems)
      .values({ sourceId: src!.id, url: 'https://ign.com/x', canonicalUrl: 'https://ign.com/x', title: 'GTA 6 rumor about map size', excerpt: 'A leaker claims...', contentHash: 'x', titleFingerprint: 'map rumor size', suggestedStatus: 'rumor' })
      .returning();
    const res = await as(editor, 'POST', `/source-items/${item!.id}/draft`, {});
    expect(res.statusCode).toBe(201);
    expect(res.json().generator).toBe('template');
    const art = (await as(editor, 'GET', `/articles/${res.json().articleId}`)).json();
    expect(art.verificationStatus).toBe('rumor');
    expect(art.category.slug).toBe('rumores');
    expect(art.sourceItem.item.url).toBe('https://ign.com/x');
    await as(editor, 'POST', `/articles/${art.id}/transition`, { to: 'in_review' });
    expect((await as(editor, 'POST', `/articles/${art.id}/transition`, { to: 'approved' })).statusCode).toBe(400);
    expect((await as(editor, 'POST', `/source-items/${item!.id}/draft`, {})).statusCode).toBe(409);
  });
});

describe('Banners, produtos e cliques', () => {
  it('banner ativo aparece; expirado não', async () => {
    const base = { slot: 'home_primary', title: 'Consoles', ctaLabel: 'Ver ofertas', targetUrl: 'https://www.amazon.com.br/dp/TESTE?tag=x', status: 'active', priority: 5 };
    const active = await as(admin, 'POST', '/banners', base);
    expect(active.statusCode).toBe(201);
    await as(admin, 'POST', '/banners', { ...base, title: 'Expirado', priority: 50, startsAt: '2026-01-01T00:00:00Z', endsAt: '2026-01-02T00:00:00Z' });
    const site = (await app.inject({ method: 'GET', url: '/api/public/site' })).json() as PublicSiteData;
    expect(site.banners).toHaveLength(1);
    expect(site.banners[0]!.title).toBe('Consoles');

    const go = await app.inject({ method: 'GET', url: `/go/banner/${active.json().id}?p=home_primary`, headers: { referer: 'https://meusite.test/' } });
    expect(go.statusCode).toBe(302);
    expect(go.headers.location).toBe('https://www.amazon.com.br/dp/TESTE?tag=x');
  });
  it('redirecionamento não aceita destino externo arbitrário', async () => {
    const res = await app.inject({ method: 'GET', url: '/go/banner/9999?url=https://evil.test' });
    expect(res.statusCode).toBe(404);
  });
  it('preço sem data de verificação é recusado; preço expirado fica oculto', async () => {
    const p = { name: 'Console de teste', category: 'console', store: 'Amazon', affiliateUrl: 'https://www.amazon.com.br/dp/C', availability: 'in_stock', active: true };
    expect((await as(admin, 'POST', '/products', { ...p, priceCents: 349900 })).statusCode).toBe(400);
    const old = await as(admin, 'POST', '/products', { ...p, priceCents: 349900, priceCheckedAt: '2026-01-01T00:00:00Z' });
    expect(old.statusCode).toBe(201);
    const fresh = await as(admin, 'POST', '/products', { ...p, name: 'Controle', priceCents: 49900, priceCheckedAt: new Date().toISOString() });
    expect(fresh.statusCode).toBe(201);
    const site = (await app.inject({ method: 'GET', url: '/api/public/site' })).json() as PublicSiteData;
    expect(site.products.find((x) => x.name === 'Console de teste')!.priceCents).toBeNull();
    expect(site.products.find((x) => x.name === 'Controle')!.priceCents).toBe(49900);
  });
  it('métricas contam os cliques', async () => {
    const m = (await as(admin, 'GET', '/metrics?days=7')).json();
    expect(m.clicksByPlacement[0].placement).toBe('home_primary');
  });
});

describe('Canais', () => {
  it('rejeita link que não é convite oficial', async () => {
    expect((await as(admin, 'POST', '/channels', { kind: 'whatsapp', label: 'WhatsApp', url: 'https://bit.ly/x', active: true })).statusCode).toBe(400);
    expect((await as(admin, 'POST', '/channels', { kind: 'telegram', label: 'Telegram', url: 'https://t.me/canal_teste', active: true })).statusCode).toBe(201);
  });
});

describe('Estúdio', () => {
  it('gera pacote social para artigo publicado (modelo sem IA)', async () => {
    const list = (await as(admin, 'GET', '/articles?status=published&pageSize=1')).json();
    const res = await as(admin, 'POST', `/studio/articles/${list.items[0].id}/package`, {});
    expect(res.statusCode).toBe(201);
    const pkg = res.json().data;
    expect(pkg.titles).toHaveLength(3);
    expect(pkg.scripts.s15.scenes.reduce((s: number, x: { seconds: number }) => s + x.seconds, 0)).toBe(15);
    expect(pkg.scripts.s60.scenes.reduce((s: number, x: { seconds: number }) => s + x.seconds, 0)).toBe(60);
    expect(pkg.channelCta).toContain('Telegram');
  });
});
