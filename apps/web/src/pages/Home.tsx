import { Link } from 'react-router';
import {
  ArrowRight,
  BookOpen,
  Building2,
  CalendarDays,
  Flame,
  Gamepad2,
  Hash,
  MapPin,
  MessageCircleQuestion,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Bug,
} from 'lucide-react';
import type { PublicFacts, PublicSiteData } from '@pgi/shared';
import { NeonScene } from '../components/Art.tsx';
import { ArticleCard, ChannelsCta, ProductCard, PromoBanner } from '../components/cards.tsx';
import { Empty, ErrorState, Loading, SectionHead, StatusBadge } from '../components/ui.tsx';
import { useSite } from '../lib/data.ts';
import { daysUntil, formatDate, parsePtDate } from '../lib/format.ts';
import { useSeo } from '../lib/seo.ts';

function Countdown({ facts }: { facts: PublicFacts }) {
  const f = facts.releaseDate;
  const iso = f ? parsePtDate(f.value) : null;
  if (!f || !iso) return null;
  const days = daysUntil(iso);
  return (
    <div className="countdown" aria-label={`Lançamento previsto: ${f.value}`}>
      {days > 0 ? (
        <>
          <div className="countdown__label">Faltam</div>
          <div className="countdown__days">{days}</div>
          <div className="countdown__unit">{days === 1 ? 'DIA' : 'DIAS'}</div>
        </>
      ) : (
        <div className="countdown__label">{days === 0 ? 'Lançamento hoje' : 'Já lançado'}</div>
      )}
      <div className="countdown__date">{formatDate(iso, { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()}</div>
      <div className="countdown__src">
        <StatusBadge status={f.status} />{' '}
        <a href={f.sourceUrl} target="_blank" rel="noopener noreferrer">
          fonte oficial
        </a>
      </div>
    </div>
  );
}

function FactsStrip({ facts }: { facts: PublicFacts }) {
  const items = [
    { k: 'releaseDate', label: 'Data de lançamento', icon: <CalendarDays size={20} /> },
    { k: 'platforms', label: 'Plataformas', icon: <Gamepad2 size={20} /> },
    { k: 'developer', label: 'Desenvolvedora', icon: <Building2 size={20} /> },
    { k: 'setting', label: 'Localização', icon: <MapPin size={20} /> },
  ] as const;
  return (
    <div className="facts">
      {items.map(({ k, label, icon }) => {
        const f = facts[k];
        if (!f) return null;
        return (
          <div className="fact" key={k}>
            <div className="fact__icon" aria-hidden="true">
              {icon}
            </div>
            <div style={{ minWidth: 0 }}>
              <div className="fact__label">{label}</div>
              <div className="fact__value">
                <a href={f.sourceUrl} target="_blank" rel="noopener noreferrer" title={`Fonte — ${f.status === 'confirmed' ? 'confirmado' : f.status}`}>
                  {f.value}
                </a>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function topTags(data: PublicSiteData) {
  const counts = new Map<string, number>();
  for (const a of data.articles) for (const t of a.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
}

export function Home() {
  const { data, isLoading, isError, refetch } = useSite();

  useSeo(
    data
      ? {
          title: data.settings.siteName,
          description: `${data.settings.tagline}. Fontes, datas e status de verificação em cada notícia.`,
          path: '/',
          siteName: data.settings.siteName,
          jsonLd: {
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            name: data.settings.siteName,
            inLanguage: 'pt-BR',
            potentialAction: { '@type': 'SearchAction', target: `${window.location.origin}${import.meta.env.BASE_URL}busca?q={q}`, 'query-input': 'required name=q' },
          },
        }
      : null,
  );

  if (isLoading) {
    return (
      <div className="container section">
        <Loading label="Carregando a página inicial…" />
      </div>
    );
  }
  if (isError || !data) {
    return (
      <div className="container section">
        <ErrorState onRetry={() => void refetch()} />
      </div>
    );
  }

  const featured = data.articles.find((a) => a.featured) ?? data.articles[0];
  const rest = data.articles.filter((a) => a !== featured);
  const official = data.articles.filter((a) => a.category.slug === 'oficial' && a !== featured).slice(0, 3);
  const rumors = data.articles.filter((a) => ['rumor', 'theory'].includes(a.verificationStatus) || a.category.slug === 'rumores').slice(0, 3);
  const guideCount = (kind: string) => data.guide.filter((g) => g.kind === kind).length;
  const bySlot = (slot: 'home_primary' | 'home_secondary') => data.banners.find((b) => b.slot === slot);
  const tags = topTags(data);

  return (
    <>
      <section className="hero" aria-labelledby="manchete">
        <div className="hero__art">
          <NeonScene seed={featured?.slug ?? 'home'} variant={0} />
        </div>
        <div className="container hero__inner">
          <div>
            {featured ? (
              <>
                <div className="hero__meta">
                  <span className="badge badge--category">{featured.category.name}</span>
                  <StatusBadge status={featured.verificationStatus} />
                  <time dateTime={featured.publishedAt}>{formatDate(featured.publishedAt)}</time>
                </div>
                <h1 id="manchete">
                  <Link to={`/noticias/${featured.slug}`}>{featured.title}</Link>
                </h1>
                <p className="hero__summary">{featured.summary}</p>
                <Link className="btn btn--primary" to={`/noticias/${featured.slug}`}>
                  Ler notícia completa <ArrowRight size={16} aria-hidden="true" />
                </Link>
              </>
            ) : (
              <>
                <h1 id="manchete">{data.settings.siteName}</h1>
                <p className="hero__summary">{data.settings.tagline}</p>
              </>
            )}
          </div>
          <Countdown facts={data.facts} />
        </div>
      </section>

      <div className="container" style={{ marginTop: 20 }}>
        <FactsStrip facts={data.facts} />
      </div>

      <div className="container section">
        <h2 className="sr-only">Destaques comerciais</h2>
        <div className="banners">
          <PromoBanner slot="home_primary" banner={bySlot('home_primary')} />
          <PromoBanner slot="home_secondary" banner={bySlot('home_secondary')} />
        </div>
      </div>

      <div className="container layout-main">
        <div>
          <section className="section" style={{ paddingTop: 0 }} aria-labelledby="ultimas">
            <SectionHead
              title="Últimas notícias"
              icon={<Flame size={22} aria-hidden="true" />}
              action={
                <Link className="link-arrow" to="/noticias">
                  Ver todas <ArrowRight size={14} aria-hidden="true" />
                </Link>
              }
            />
            <span id="ultimas" className="sr-only">Últimas notícias</span>
            {rest.length ? (
              <div className="grid grid--3">
                {rest.slice(0, 6).map((a) => (
                  <ArticleCard key={a.slug} article={a} />
                ))}
              </div>
            ) : (
              <Empty title="Nenhuma outra notícia publicada ainda" />
            )}
          </section>

          {official.length > 0 && (
            <section className="section" aria-label="Notícias oficiais">
              <SectionHead
                title="Notícias oficiais"
                icon={<ShieldCheck size={22} aria-hidden="true" />}
                description="Anúncios e materiais publicados pela Rockstar Games."
                action={
                  <Link className="link-arrow" to="/oficiais">
                    Ver oficiais <ArrowRight size={14} aria-hidden="true" />
                  </Link>
                }
              />
              <div className="grid grid--3">
                {official.map((a) => (
                  <ArticleCard key={a.slug} article={a} />
                ))}
              </div>
            </section>
          )}

          <section className="section" aria-label="Rumores e teorias">
            <SectionHead
              title="Rumores e teorias"
              icon={<MessageCircleQuestion size={22} aria-hidden="true" />}
              description="Sempre identificados: nada aqui é informação confirmada."
              action={
                <Link className="link-arrow" to="/rumores">
                  Ver todos <ArrowRight size={14} aria-hidden="true" />
                </Link>
              }
            />
            {rumors.length ? (
              <div className="grid grid--3">
                {rumors.map((a) => (
                  <ArticleCard key={a.slug} article={a} />
                ))}
              </div>
            ) : (
              <Empty title="Nenhum rumor em análise no momento" />
            )}
          </section>

          <section className="section" aria-label="Guia e descobertas">
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
              <div className="panel">
                <h3>
                  <BookOpen size={18} aria-hidden="true" /> Guia do universo GTA VI
                </h3>
                <ul className="list-plain list-links">
                  <li><Link to="/historia">História e cronologia <span className="count">{guideCount('history')}</span></Link></li>
                  <li><Link to="/personagens">Personagens <span className="count">{guideCount('character')}</span></Link></li>
                  <li><Link to="/mapa">Mapa e locais <span className="count">{guideCount('location')}</span></Link></li>
                  <li><Link to="/universo">Veículos e atividades <span className="count">{guideCount('vehicle') + guideCount('activity')}</span></Link></li>
                  <li><Link to="/guias">Perguntas frequentes <span className="count">{guideCount('faq')}</span></Link></li>
                </ul>
              </div>
              <div className="panel">
                <h3>
                  <Bug size={18} aria-hidden="true" /> Glitches, segredos e descobertas
                </h3>
                {data.discoveries.length ? (
                  <ul className="list-plain list-links">
                    {data.discoveries.slice(0, 5).map((d) => (
                      <li key={d.slug}>
                        <Link to={`/glitches#${d.slug}`}>
                          {d.title} <StatusBadge status={d.verificationStatus} withTitle={false} />
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted small">
                    O jogo ainda não foi lançado. Esta seção só vai registrar descobertas com evidências verificáveis: não publicamos glitches inventados ou de
                    origem desconhecida.
                  </p>
                )}
                <Link className="link-arrow" to="/glitches">
                  Ver a seção <ArrowRight size={14} aria-hidden="true" />
                </Link>
              </div>
            </div>
          </section>
        </div>

        <aside className="section" style={{ paddingTop: 0 }} aria-label="Barra lateral">
          {data.channels.length > 0 && <ChannelsCta channels={data.channels} compact placement="home_sidebar" />}
          {tags.length > 0 && (
            <div className="panel" style={{ marginTop: data.channels.length ? 16 : 0 }}>
              <h3>
                <Hash size={18} aria-hidden="true" /> Assuntos mais cobertos
              </h3>
              <ul className="list-plain list-links">
                {tags.map(([t, n]) => (
                  <li key={t}>
                    <Link to={`/noticias?tag=${encodeURIComponent(t)}`}>
                      #{t} <span className="count">{n}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="panel">
            <h3>
              <Sparkles size={18} aria-hidden="true" /> Como verificamos
            </h3>
            <p className="small muted" style={{ margin: 0 }}>
              Cada texto traz o status de verificação (<StatusBadge status="confirmed" withTitle={false} />, <StatusBadge status="reported" withTitle={false} />,{' '}
              <StatusBadge status="rumor" withTitle={false} /> …), as fontes consultadas e a data. <Link to="/sobre#verificacao">Ver critérios</Link>.
            </p>
          </div>
        </aside>
      </div>

      {data.products.length > 0 && (
        <section className="container section" aria-label="Ofertas em destaque">
          <SectionHead
            title="Ofertas em destaque"
            icon={<ShoppingBag size={22} aria-hidden="true" />}
            description="Preços exibidos apenas quando verificados nas últimas 24 horas."
            action={
              <Link className="link-arrow" to="/ofertas">
                Ver vitrine <ArrowRight size={14} aria-hidden="true" />
              </Link>
            }
          />
          <div className="grid">
            {data.products.slice(0, 4).map((p) => (
              <ProductCard key={p.id} product={p} placement="home_showcase" />
            ))}
          </div>
          <p className="disclosure" style={{ marginTop: 14 }}>
            Links de afiliados: podemos receber comissão por compras qualificadas. Não há patrocínio da Rockstar, PlayStation ou Amazon.
          </p>
        </section>
      )}

      {data.channels.length > 0 && (
        <div className="container section">
          <ChannelsCta channels={data.channels} placement="home_band" />
        </div>
      )}
    </>
  );
}
