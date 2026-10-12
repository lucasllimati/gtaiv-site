/**
 * Pré-renderização estática após o `vite build`.
 * Para cada rota pública e cada artigo, gera dist/<rota>/index.html com:
 *  - <title>, description, canonical, Open Graph e JSON-LD corretos;
 *  - o conteúdo essencial em HTML semântico dentro de #root (lido por buscadores
 *    e substituído pelo React quando o JavaScript carrega).
 * Também cria 404.html (fallback de SPA no GitHub Pages).
 */
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PublicArticle, PublicSiteData } from '@pgi/shared';
import { VERIFICATION_LABELS } from '@pgi/shared';

const dist = resolve(dirname(fileURLToPath(import.meta.url)), '../dist');
const base = (process.env.VITE_BASE ?? '/').replace(/\/?$/, '/');
const siteUrl = (process.env.VITE_SITE_URL ?? '').replace(/\/$/, '');

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const link = (path: string) => `${base}${path.replace(/^\//, '')}`;
const canonical = (path: string) => (siteUrl ? `${siteUrl}${path}` : '');

interface PageDef {
  path: string;
  title: string;
  description: string;
  body: string;
  type?: 'website' | 'article';
  jsonLd?: unknown;
  image?: string | null;
}

function head(p: PageDef, siteName: string): string {
  const full = p.title === siteName ? p.title : `${p.title} | ${siteName}`;
  const url = canonical(p.path);
  const tags = [
    `<title>${esc(full)}</title>`,
    `<meta name="description" content="${esc(p.description)}" />`,
    `<meta property="og:title" content="${esc(full)}" />`,
    `<meta property="og:description" content="${esc(p.description)}" />`,
    `<meta property="og:type" content="${p.type ?? 'website'}" />`,
    `<meta property="og:site_name" content="${esc(siteName)}" />`,
    `<meta property="og:locale" content="pt_BR" />`,
    `<meta name="twitter:card" content="${p.image ? 'summary_large_image' : 'summary'}" />`,
  ];
  if (url) tags.push(`<link rel="canonical" href="${esc(url)}" />`, `<meta property="og:url" content="${esc(url)}" />`);
  if (p.image) tags.push(`<meta property="og:image" content="${esc(p.image)}" />`);
  if (p.jsonLd) tags.push(`<script type="application/ld+json">${JSON.stringify(p.jsonLd).replace(/</g, '\\u003c')}</script>`);
  return tags.join('\n    ');
}

function nav(): string {
  const items: [string, string][] = [
    ['/', 'Início'],
    ['/noticias', 'Notícias'],
    ['/oficiais', 'Oficiais'],
    ['/rumores', 'Rumores'],
    ['/universo', 'Universo'],
    ['/glitches', 'Glitches'],
    ['/guias', 'Guias'],
    ['/ofertas', 'Ofertas'],
  ];
  return `<nav aria-label="Principal"><ul>${items.map(([h, l]) => `<li><a href="${link(h)}">${l}</a></li>`).join('')}</ul></nav>`;
}

function articleList(arts: PublicSiteData['articles']): string {
  if (!arts.length) return '<p>Nenhuma publicação nesta seção ainda.</p>';
  return `<ul>${arts
    .map((a) => `<li><a href="${link(`/noticias/${a.slug}`)}">${esc(a.title)}</a> — <em>${VERIFICATION_LABELS[a.verificationStatus]}</em>. ${esc(a.summary)}</li>`)
    .join('')}</ul>`;
}

async function main() {
  const template = await readFile(join(dist, 'index.html'), 'utf8');
  const sitePath = join(dist, 'data', 'site.json');
  if (!existsSync(sitePath)) {
    console.warn('prerender: dist/data/site.json não encontrado — rode `npm run export` antes do build. Pulando pré-renderização.');
    await writeFile(join(dist, '404.html'), template);
    return;
  }
  const site = JSON.parse(await readFile(sitePath, 'utf8')) as PublicSiteData;
  const name = site.settings.siteName;
  const g = (k: string) => site.guide.filter((x) => x.kind === k);
  const guideList = (k: string) => `<ul>${g(k).map((x) => `<li><strong>${esc(x.title)}</strong> — ${esc(x.summary)}</li>`).join('')}</ul>`;

  const pages: PageDef[] = [
    {
      path: '/',
      title: name,
      description: `${site.settings.tagline}. Fontes, datas e status de verificação em cada notícia.`,
      jsonLd: { '@context': 'https://schema.org', '@type': 'WebSite', name, inLanguage: 'pt-BR', url: canonical('/') || undefined },
      body: `<h1>${esc(name)}</h1><p>${esc(site.settings.tagline)}</p><h2>Últimas notícias</h2>${articleList(site.articles.slice(0, 10))}`,
    },
    { path: '/noticias', title: 'Notícias', description: 'Toda a cobertura sobre GTA VI, com fonte, data e status de verificação.', body: `<h1>Notícias</h1>${articleList(site.articles)}` },
    { path: '/oficiais', title: 'Notícias oficiais', description: 'Anúncios e materiais publicados pela Rockstar Games.', body: `<h1>Notícias oficiais</h1>${articleList(site.articles.filter((a) => a.category.slug === 'oficial'))}` },
    {
      path: '/rumores',
      title: 'Rumores e teorias',
      description: 'Informações não confirmadas sobre GTA VI, sempre identificadas como tal.',
      body: `<h1>Rumores e teorias</h1>${articleList(site.articles.filter((a) => a.category.slug === 'rumores' || ['rumor', 'theory', 'debunked'].includes(a.verificationStatus)))}`,
    },
    { path: '/historia', title: 'História e cronologia', description: 'Linha do tempo de GTA VI com fonte em cada etapa.', body: `<h1>História e cronologia</h1>${guideList('history')}` },
    { path: '/personagens', title: 'Personagens', description: 'Personagens de GTA VI apresentados oficialmente.', body: `<h1>Personagens</h1>${guideList('character')}` },
    { path: '/mapa', title: 'Mapa e locais', description: 'Regiões de Leonida e Vice City apresentadas oficialmente.', body: `<h1>Mapa e locais</h1>${guideList('location')}` },
    { path: '/universo', title: 'Universo GTA VI', description: 'Guia do universo de GTA VI: história, personagens, locais, veículos e atividades.', body: '<h1>Universo GTA VI</h1>' },
    { path: '/glitches', title: 'Glitches, segredos e descobertas', description: 'Glitches, bugs, segredos e easter eggs de GTA VI com evidências.', body: `<h1>Glitches, segredos e descobertas</h1><ul>${site.discoveries.map((d) => `<li>${esc(d.title)}</li>`).join('')}</ul>` },
    {
      path: '/guias',
      title: 'Guias e perguntas frequentes',
      description: 'Guias práticos e respostas diretas sobre GTA VI.',
      body: `<h1>Guias e perguntas frequentes</h1>${guideList('faq')}`,
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: g('faq').map((f) => ({ '@type': 'Question', name: f.title, acceptedAnswer: { '@type': 'Answer', text: `${f.summary} ${f.body}`.trim() } })),
      },
    },
    { path: '/ofertas', title: 'Ofertas e produtos', description: 'Consoles, jogos e acessórios com preço verificado e link afiliado identificado.', body: '<h1>Ofertas e produtos</h1>' },
    { path: '/busca', title: 'Buscar', description: 'Busque notícias, guias e descobertas sobre GTA VI.', body: '<h1>Buscar</h1>' },
    { path: '/sobre', title: 'Sobre o projeto', description: 'Quem somos e como verificamos as informações.', body: '<h1>Sobre o projeto</h1>' },
    { path: '/contato', title: 'Contato', description: 'Fale com a redação.', body: '<h1>Contato</h1>' },
    { path: '/politica-de-privacidade', title: 'Política de privacidade', description: 'Como tratamos dados pessoais (LGPD).', body: '<h1>Política de privacidade</h1>' },
    { path: '/termos', title: 'Termos de uso', description: 'Condições de uso do portal.', body: '<h1>Termos de uso</h1>' },
    { path: '/divulgacao', title: 'Publicidade e links de afiliados', description: 'Como funcionam os links de afiliados.', body: '<h1>Publicidade e links de afiliados</h1>' },
  ];

  for (const a of site.articles) {
    const fp = join(dist, 'data', 'articles', `${a.slug}.json`);
    if (!existsSync(fp)) continue;
    const art = JSON.parse(await readFile(fp, 'utf8')) as PublicArticle;
    pages.push({
      path: `/noticias/${art.slug}`,
      title: art.title,
      description: art.summary,
      type: 'article',
      image: art.coverUrl,
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'NewsArticle',
        headline: art.title,
        description: art.summary,
        datePublished: art.publishedAt,
        dateModified: art.updatedAt,
        inLanguage: 'pt-BR',
        author: { '@type': 'Organization', name: `${name} — ${art.authorName}` },
        publisher: { '@type': 'Organization', name },
        citation: art.sources.map((s) => s.url),
        ...(art.coverUrl ? { image: [art.coverUrl] } : {}),
      },
      body: `<article><h1>${esc(art.title)}</h1><p><strong>${VERIFICATION_LABELS[art.verificationStatus]}</strong> · ${esc(art.category.name)}</p><p>${esc(art.summary)}</p><h2>Fontes</h2><ol>${art.sources
        .map((s) => `<li><a href="${esc(s.url)}" rel="noopener noreferrer">${esc(s.title)}</a> — ${esc(s.publisher)}</li>`)
        .join('')}</ol></article>`,
    });
  }

  for (const p of pages) {
    const html = template
      .replace(/<!--seo-->[\s\S]*?<!--\/seo-->/, head(p, name))
      .replace('<!--app-->', `<div class="prerender">${nav()}<main>${p.body}</main></div>`);
    const out = p.path === '/' ? join(dist, 'index.html') : join(dist, p.path, 'index.html');
    await mkdir(dirname(out), { recursive: true });
    await writeFile(out, html);
  }

  const notFound = template.replace(/<!--seo-->[\s\S]*?<!--\/seo-->/, head({ path: '/404', title: 'Página não encontrada', description: 'A página procurada não existe.', body: '' }, name).replace('<meta name="description"', '<meta name="robots" content="noindex" />\n    <meta name="description"'));
  await writeFile(join(dist, '404.html'), notFound);
  console.log(`prerender: ${pages.length} páginas geradas.`);
}

await main();
