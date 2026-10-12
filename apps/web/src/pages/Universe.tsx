import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { AlertTriangle, ArrowRight, BookOpen, Bug, Car, Clock3, Map, MapPin, ShoppingBag, Users, Zap } from 'lucide-react';
import {
  DISCOVERY_KIND_LABELS,
  DISCOVERY_KINDS,
  GUIDE_KIND_LABELS,
  PRODUCT_CATEGORIES,
  PRODUCT_CATEGORY_LABELS,
  type GuideKind,
  type PublicGuideEntry,
} from '@pgi/shared';
import { ArticleCard, ProductCard } from '../components/cards.tsx';
import { Empty, ErrorState, Loading, SectionHead, StatusBadge } from '../components/ui.tsx';
import { useSite, type SiteResult } from '../lib/data.ts';
import { formatDate } from '../lib/format.ts';
import { renderMarkdown } from '../lib/markdown.ts';
import { useSeo } from '../lib/seo.ts';

function useSitePage(title: string, description: string, path: string) {
  const q = useSite();
  useSeo(q.data ? { title, description, path, siteName: q.data.settings.siteName } : null);
  return q;
}

function PageShell({ title, lead, children, q }: { title: string; lead: string; children: (d: SiteResult) => React.ReactNode; q: ReturnType<typeof useSite> }) {
  return (
    <div className="container">
      <header className="page-hero">
        <h1>{title}</h1>
        <p className="lead">{lead}</p>
      </header>
      {q.isLoading ? <Loading /> : q.isError || !q.data ? <ErrorState onRetry={() => void q.refetch()} /> : children(q.data)}
    </div>
  );
}

function Sources({ sources }: { sources: PublicGuideEntry['sources'] }) {
  if (!sources.length) return null;
  return (
    <div className="entry__sources">
      Fonte:{' '}
      {sources.map((s, i) => (
        <span key={s.url}>
          {i > 0 && ' · '}
          <a href={s.url} target="_blank" rel="noopener noreferrer">
            {s.label}
          </a>
        </span>
      ))}
    </div>
  );
}

function EntryGrid({ entries, avatar }: { entries: PublicGuideEntry[]; avatar?: boolean }) {
  return (
    <div className="grid">
      {entries.map((e) => (
        <article key={e.slug} id={e.slug} className="entry">
          <div className="entry__head">
            <div className="row" style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}>
              {avatar && (
                <div className="entry__avatar" aria-hidden="true">
                  {e.title
                    .split(/\s+/)
                    .map((w) => w[0])
                    .join('')
                    .slice(0, 2)}
                </div>
              )}
              <div>
                <h3>{e.title}</h3>
                <StatusBadge status={e.verificationStatus} />
              </div>
            </div>
          </div>
          <p style={{ marginTop: 10 }}>{e.summary}</p>
          {e.body && <div className="prose small" style={{ fontSize: '0.92rem', marginTop: 8 }} dangerouslySetInnerHTML={{ __html: renderMarkdown(e.body) }} />}
          <Sources sources={e.sources} />
        </article>
      ))}
    </div>
  );
}

const unconfirmedNote = (
  <p className="muted small">
    Mostramos apenas o que foi apresentado oficialmente ou por fontes identificadas. Detalhes não confirmados aparecem em{' '}
    <Link to="/rumores">Rumores e teorias</Link>.
  </p>
);

export function HistoryPage() {
  const q = useSitePage('História e cronologia', 'Linha do tempo de GTA VI, do anúncio ao lançamento, com fonte em cada etapa.', '/historia');
  return (
    <PageShell q={q} title="História e cronologia" lead="Os marcos de Grand Theft Auto VI, do anúncio ao lançamento. Cada etapa tem fonte e status de verificação.">
      {(d) => {
        const items = d.guide.filter((g) => g.kind === 'history').sort((a, b) => (a.eventDate ?? '').localeCompare(b.eventDate ?? ''));
        return items.length ? (
          <ol className="timeline">
            {items.map((e) => (
              <li key={e.slug} id={e.slug}>
                <time dateTime={e.eventDate ?? undefined}>{formatDate(e.eventDate)}</time>
                <h2 style={{ fontSize: '1.15rem', margin: '4px 0 6px' }}>{e.title}</h2>
                <div className="row" style={{ marginBottom: 6 }}>
                  <StatusBadge status={e.verificationStatus} />
                  {e.verificationStatus === 'outdated' && <span className="muted small">Informação substituída por anúncio posterior.</span>}
                </div>
                <p className="muted" style={{ margin: 0 }}>
                  {e.summary}
                </p>
                <Sources sources={e.sources} />
              </li>
            ))}
          </ol>
        ) : (
          <Empty title="Cronologia em construção" />
        );
      }}
    </PageShell>
  );
}

export function CharactersPage() {
  const q = useSitePage('Personagens', 'Personagens de GTA VI apresentados oficialmente pela Rockstar Games.', '/personagens');
  return (
    <PageShell q={q} title="Personagens" lead="Quem já foi apresentado oficialmente em GTA VI. Descrições resumidas pela redação a partir dos materiais oficiais.">
      {(d) => {
        const items = d.guide.filter((g) => g.kind === 'character');
        return (
          <>
            {unconfirmedNote}
            {items.length ? <EntryGrid entries={items} avatar /> : <Empty title="Nenhum personagem cadastrado" />}
          </>
        );
      }}
    </PageShell>
  );
}

export function MapPage() {
  const q = useSitePage('Mapa e locais', 'Regiões de Leonida e Vice City apresentadas oficialmente em GTA VI.', '/mapa');
  return (
    <PageShell q={q} title="Mapa e locais" lead="O estado de Leonida e suas regiões, segundo os materiais oficiais. O mapa completo ainda não foi divulgado.">
      {(d) => {
        const items = d.guide.filter((g) => g.kind === 'location');
        return (
          <>
            <div className="alert alert--info" role="note">
              <MapPin size={16} aria-hidden="true" style={{ display: 'inline', verticalAlign: '-3px' }} /> Mapas completos que circulam na internet são
              recriações de fãs ou especulações, não material oficial.
            </div>
            {items.length ? <EntryGrid entries={items} /> : <Empty title="Nenhum local cadastrado" />}
          </>
        );
      }}
    </PageShell>
  );
}

export function UniversePage() {
  const q = useSitePage('Universo GTA VI', 'Guia do universo de GTA VI: história, personagens, locais, veículos e atividades confirmados.', '/universo');
  return (
    <PageShell q={q} title="Universo GTA VI" lead="O guia do mundo de GTA VI, separando o que foi revelado oficialmente do que ainda é especulação.">
      {(d) => {
        const by = (k: GuideKind) => d.guide.filter((g) => g.kind === k);
        const hubs = [
          { to: '/historia', icon: <Clock3 size={20} />, label: 'História e cronologia', n: by('history').length },
          { to: '/personagens', icon: <Users size={20} />, label: 'Personagens', n: by('character').length },
          { to: '/mapa', icon: <Map size={20} />, label: 'Mapa e locais', n: by('location').length },
          { to: '/guias', icon: <BookOpen size={20} />, label: 'Guias e FAQ', n: by('faq').length },
        ];
        return (
          <>
            <div className="grid" style={{ marginBottom: 32 }}>
              {hubs.map((h) => (
                <Link key={h.to} to={h.to} className="fact" style={{ textDecoration: 'none', color: 'inherit' }}>
                  <div className="fact__icon" aria-hidden="true">
                    {h.icon}
                  </div>
                  <div>
                    <div className="fact__value">{h.label}</div>
                    <div className="muted small">{h.n} {h.n === 1 ? 'item' : 'itens'}</div>
                  </div>
                </Link>
              ))}
            </div>
            {(['vehicle', 'activity'] as const).map((k) => (
              <section key={k} className="section" style={{ paddingTop: 0 }}>
                <SectionHead title={GUIDE_KIND_LABELS[k]} icon={k === 'vehicle' ? <Car size={22} aria-hidden="true" /> : <Zap size={22} aria-hidden="true" />} />
                {by(k).length ? (
                  <EntryGrid entries={by(k)} />
                ) : (
                  <Empty title={`Nenhum${k === 'vehicle' ? ' veículo' : 'a atividade'} confirmad${k === 'vehicle' ? 'o' : 'a'} por aqui ainda`}>
                    Vamos listar {k === 'vehicle' ? 'veículos' : 'atividades'} quando houver confirmação oficial ou evidência verificável. Não
                    publicamos listas baseadas em rumores.
                  </Empty>
                )}
              </section>
            ))}
          </>
        );
      }}
    </PageShell>
  );
}

export function GlitchesPage() {
  const q = useSitePage('Glitches, segredos e descobertas', 'Base de glitches, bugs, segredos e easter eggs de GTA VI, com evidências e status de verificação.', '/glitches');
  const [kind, setKind] = useState('');
  return (
    <PageShell q={q} title="Glitches, segredos e descobertas" lead="Glitches, bugs, segredos e easter eggs com passos de reprodução, evidências, plataforma e versão.">
      {(d) => {
        const items = d.discoveries.filter((x) => !kind || x.kind === kind);
        return (
          <>
            <div className="alert alert--warn" role="note">
              <AlertTriangle size={16} aria-hidden="true" style={{ display: 'inline', verticalAlign: '-3px' }} /> Antes do lançamento, esta seção só aceita
              descobertas sustentadas por materiais públicos verificáveis, identificadas como análise. Não publicamos glitches inventados. Reproduzir
              glitches pode causar perda de progresso.
            </div>
            {d.discoveries.length > 0 && (
              <div className="filters">
                <button type="button" className="chip" aria-pressed={!kind} onClick={() => setKind('')}>
                  Todas
                </button>
                {DISCOVERY_KINDS.map((k) => (
                  <button key={k} type="button" className="chip" aria-pressed={kind === k} onClick={() => setKind(kind === k ? '' : k)}>
                    {DISCOVERY_KIND_LABELS[k]}
                  </button>
                ))}
              </div>
            )}
            {items.length === 0 ? (
              <Empty title="Nenhuma descoberta verificada ainda" icon={<Bug size={32} aria-hidden="true" />}>
                Quando o jogo for lançado, glitches e segredos confirmados pela comunidade aparecerão aqui, com evidência, versão do jogo e plataforma.
              </Empty>
            ) : (
              <div className="stack">
                {items.map((x) => (
                  <article key={x.slug} id={x.slug} className="entry">
                    <div className="entry__head">
                      <div>
                        <div className="row" style={{ marginBottom: 6 }}>
                          <span className="badge badge--category">{DISCOVERY_KIND_LABELS[x.kind]}</span>
                          <StatusBadge status={x.verificationStatus} />
                        </div>
                        <h2 style={{ fontSize: '1.2rem' }}>{x.title}</h2>
                      </div>
                    </div>
                    <p>{x.description}</p>
                    <dl className="small muted" style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 12px', margin: '12px 0' }}>
                      <dt>Versão</dt>
                      <dd style={{ margin: 0 }}>{x.gameVersion ?? 'não informada'}</dd>
                      <dt>Plataformas</dt>
                      <dd style={{ margin: 0 }}>{x.platforms.length ? x.platforms.join(', ') : 'não informadas'}</dd>
                      <dt>Última confirmação</dt>
                      <dd style={{ margin: 0 }}>{x.lastConfirmedAt ? formatDate(x.lastConfirmedAt) : '—'}</dd>
                      {x.fixedInVersion && (
                        <>
                          <dt>Corrigido em</dt>
                          <dd style={{ margin: 0 }}>{x.fixedInVersion}</dd>
                        </>
                      )}
                    </dl>
                    {x.riskWarning && (
                      <div className="alert alert--error" role="note">
                        <strong>Atenção:</strong> {x.riskWarning}
                      </div>
                    )}
                    {x.steps.length > 0 && (
                      <>
                        <h3>Como reproduzir</h3>
                        <ol>
                          {x.steps.map((s, i) => (
                            <li key={i}>{s}</li>
                          ))}
                        </ol>
                      </>
                    )}
                    {x.evidence.length > 0 && (
                      <p className="small">
                        Evidências:{' '}
                        {x.evidence.map((e, i) => (
                          <span key={e.url}>
                            {i > 0 && ' · '}
                            <a href={e.url} target="_blank" rel="noopener noreferrer">
                              {e.label}
                            </a>
                          </span>
                        ))}
                      </p>
                    )}
                    {x.sourceUrl && (
                      <p className="small muted" style={{ margin: 0 }}>
                        Fonte original:{' '}
                        <a href={x.sourceUrl} target="_blank" rel="noopener noreferrer">
                          {new URL(x.sourceUrl).hostname}
                        </a>
                      </p>
                    )}
                  </article>
                ))}
              </div>
            )}
          </>
        );
      }}
    </PageShell>
  );
}

export function GuidesPage() {
  const q = useSitePage('Guias e perguntas frequentes', 'Guias práticos e respostas diretas sobre GTA VI, com fontes.', '/guias');
  return (
    <PageShell q={q} title="Guias e perguntas frequentes" lead="Explicações práticas e respostas diretas, atualizadas conforme novas informações oficiais.">
      {(d) => {
        const guides = d.articles.filter((a) => a.category.slug === 'guias');
        const faq = d.guide.filter((g) => g.kind === 'faq');
        return (
          <>
            <section className="section" style={{ paddingTop: 0 }}>
              <SectionHead title="Guias" icon={<BookOpen size={22} aria-hidden="true" />} />
              {guides.length ? (
                <div className="grid grid--3">
                  {guides.map((a) => (
                    <ArticleCard key={a.slug} article={a} />
                  ))}
                </div>
              ) : (
                <Empty title="Nenhum guia publicado ainda" />
              )}
            </section>
            <section className="section" aria-labelledby="faq-h">
              <h2 id="faq-h">Perguntas frequentes</h2>
              {faq.length ? (
                faq.map((f) => (
                  <details key={f.slug} id={f.slug} className="faq">
                    <summary>{f.title}</summary>
                    <div className="faq__body">
                      <p>
                        <strong>{f.summary}</strong>
                      </p>
                      {f.body && <p>{f.body}</p>}
                      <div className="row">
                        <StatusBadge status={f.verificationStatus} />
                        <Sources sources={f.sources} />
                      </div>
                    </div>
                  </details>
                ))
              ) : (
                <Empty title="Nenhuma pergunta cadastrada" />
              )}
            </section>
          </>
        );
      }}
    </PageShell>
  );
}

export function OffersPage() {
  const q = useSitePage('Ofertas e produtos', 'Consoles, jogos, controles e acessórios com preço verificado e indicação clara de link afiliado.', '/ofertas');
  const [cat, setCat] = useState('');
  return (
    <PageShell q={q} title="Ofertas e produtos" lead="Consoles, jogos, controles e acessórios selecionados pela redação. Os preços só aparecem quando foram conferidos na loja nas últimas 24 horas.">
      {(d) => {
        const items = d.products.filter((p) => !cat || p.category === cat);
        const cats = PRODUCT_CATEGORIES.filter((c) => d.products.some((p) => p.category === c));
        return (
          <>
            <p className="disclosure">
              <strong>Publicidade e afiliados:</strong> os links desta página são de programas de afiliados. Podemos receber comissão por compras
              qualificadas, sem custo extra para você. Não há patrocínio nem parceria oficial com Rockstar, PlayStation ou Amazon.{' '}
              <Link to="/divulgacao">Saiba mais</Link>.
            </p>
            {cats.length > 1 && (
              <div className="filters" style={{ marginTop: 20 }}>
                <button type="button" className="chip" aria-pressed={!cat} onClick={() => setCat('')}>
                  Todos
                </button>
                {cats.map((c) => (
                  <button key={c} type="button" className="chip" aria-pressed={cat === c} onClick={() => setCat(cat === c ? '' : c)}>
                    {PRODUCT_CATEGORY_LABELS[c]}
                  </button>
                ))}
              </div>
            )}
            <div style={{ marginTop: 20 }}>
              {items.length ? (
                <div className="grid">
                  {items.map((p) => (
                    <ProductCard key={p.id} product={p} placement="offers_page" />
                  ))}
                </div>
              ) : (
                <Empty title="A vitrine ainda está sendo montada" icon={<ShoppingBag size={32} aria-hidden="true" />}>
                  Estamos selecionando consoles, jogos e acessórios. Só vamos exibir produtos com link verificado e preço conferido na loja; nunca preços
                  ou descontos estimados.
                </Empty>
              )}
            </div>
          </>
        );
      }}
    </PageShell>
  );
}

function norm(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export function SearchPage() {
  const [params, setParams] = useSearchParams();
  const term = params.get('q') ?? '';
  const q = useSitePage(term ? `Busca: ${term}` : 'Buscar', 'Busque notícias, guias e descobertas sobre GTA VI.', '/busca');
  const results = useMemo(() => {
    const d = q.data;
    const t = norm(term.trim());
    if (!d || t.length < 2) return null;
    const words = t.split(/\s+/);
    const hit = (s: string) => words.every((w) => norm(s).includes(w));
    return {
      articles: d.articles.filter((a) => hit(`${a.title} ${a.summary} ${a.tags.join(' ')} ${a.category.name}`)),
      guide: d.guide.filter((g) => hit(`${g.title} ${g.summary} ${g.body}`)),
      discoveries: d.discoveries.filter((x) => hit(`${x.title} ${x.description}`)),
    };
  }, [q.data, term]);
  const guidePath: Record<GuideKind, string> = { history: '/historia', character: '/personagens', location: '/mapa', vehicle: '/universo', activity: '/universo', faq: '/guias' };
  const total = results ? results.articles.length + results.guide.length + results.discoveries.length : 0;

  return (
    <PageShell q={q} title="Buscar" lead="Notícias, guias, personagens, locais e descobertas.">
      {() => (
        <>
          <form
            role="search"
            className="filters"
            onSubmit={(e) => {
              e.preventDefault();
              const v = String(new FormData(e.currentTarget).get('q') ?? '').trim();
              setParams(v ? { q: v } : {});
            }}
          >
            <div className="field" style={{ margin: 0, flex: 1, maxWidth: 520 }}>
              <label htmlFor="search-page-q" className="sr-only">
                Termo de busca
              </label>
              <input id="search-page-q" name="q" type="search" defaultValue={term} placeholder="Ex.: lançamento, Lucia, Vice City" maxLength={120} />
            </div>
            <button type="submit" className="btn btn--primary">
              Buscar
            </button>
          </form>
          {!results ? (
            <p className="muted">Digite pelo menos 2 caracteres.</p>
          ) : total === 0 ? (
            <Empty title={`Nada encontrado para “${term}”`}>Tente outro termo ou navegue pelas seções do menu.</Empty>
          ) : (
            <div className="stack">
              <p className="muted small" aria-live="polite">
                {total} resultado(s)
              </p>
              {results.articles.length > 0 && (
                <div className="grid grid--3">
                  {results.articles.map((a) => (
                    <ArticleCard key={a.slug} article={a} headingLevel={2} />
                  ))}
                </div>
              )}
              {results.guide.length + results.discoveries.length > 0 && (
                <div className="panel">
                  <h2 style={{ fontSize: '1.1rem' }}>No guia e nas descobertas</h2>
                  <ul className="list-plain list-links">
                    {results.guide.map((g) => (
                      <li key={`${g.kind}-${g.slug}`}>
                        <Link to={`${guidePath[g.kind]}#${g.slug}`}>
                          {g.title} <span className="count">{GUIDE_KIND_LABELS[g.kind]}</span>
                        </Link>
                      </li>
                    ))}
                    {results.discoveries.map((x) => (
                      <li key={x.slug}>
                        <Link to={`/glitches#${x.slug}`}>
                          {x.title} <span className="count">{DISCOVERY_KIND_LABELS[x.kind]}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <Link className="link-arrow" to="/noticias">
                Ver todas as notícias <ArrowRight size={14} aria-hidden="true" />
              </Link>
            </div>
          )}
        </>
      )}
    </PageShell>
  );
}
