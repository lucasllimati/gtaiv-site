import { useMemo } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowLeft, Clock, Share2, UserRound } from 'lucide-react';
import { VERIFICATION_LABELS } from '@pgi/shared';
import { NeonScene } from '../components/Art.tsx';
import { ArticleCard, ChannelsCta } from '../components/cards.tsx';
import { ErrorState, StatusBadge, StatusExplainer } from '../components/ui.tsx';
import { NotFoundError, useArticle, useSite } from '../lib/data.ts';
import { canonical } from '../lib/env.ts';
import { formatDate, formatDateTime } from '../lib/format.ts';
import { renderMarkdown } from '../lib/markdown.ts';
import { useSeo } from '../lib/seo.ts';
import { NotFound } from './Static.tsx';

export function ArticlePage() {
  const { slug = '' } = useParams();
  const { data: article, isLoading, isError, error, refetch } = useArticle(slug);
  const site = useSite();
  const html = useMemo(() => (article ? renderMarkdown(article.body) : ''), [article]);
  const siteName = site.data?.settings.siteName ?? 'Project GTA IV';

  useSeo(
    article
      ? {
          title: article.title,
          description: article.summary,
          path: `/noticias/${article.slug}`,
          siteName,
          type: 'article',
          image: article.coverUrl,
          publishedAt: article.publishedAt,
          updatedAt: article.updatedAt,
          jsonLd: {
            '@context': 'https://schema.org',
            '@type': 'NewsArticle',
            headline: article.title,
            description: article.summary,
            datePublished: article.publishedAt,
            dateModified: article.updatedAt,
            inLanguage: 'pt-BR',
            mainEntityOfPage: canonical(`/noticias/${article.slug}`),
            author: { '@type': 'Organization', name: `${siteName} — ${article.authorName}` },
            publisher: { '@type': 'Organization', name: siteName },
            ...(article.coverUrl ? { image: [article.coverUrl] } : {}),
            citation: article.sources.map((s) => s.url),
          },
        }
      : null,
  );

  if (isLoading) {
    return (
      <div className="container article" role="status">
        <span className="sr-only">Carregando artigo…</span>
        <div className="skeleton" style={{ minHeight: 420, marginTop: 28 }} />
      </div>
    );
  }
  if (error instanceof NotFoundError) return <NotFound />;
  if (isError || !article) {
    return (
      <div className="container section">
        <ErrorState onRetry={() => void refetch()} />
      </div>
    );
  }

  const related = (site.data?.articles ?? []).filter((a) => a.slug !== article.slug && (a.category.slug === article.category.slug || a.tags.some((t) => article.tags.includes(t)))).slice(0, 3);
  const share = async () => {
    const url = canonical(`/noticias/${article.slug}`);
    if (navigator.share) await navigator.share({ title: article.title, url }).catch(() => undefined);
    else await navigator.clipboard?.writeText(url).catch(() => undefined);
  };

  return (
    <div className="container">
      <article className="article" style={{ marginInline: 'auto' }}>
        <header className="article__header">
          <Link to="/noticias" className="link-arrow" style={{ marginBottom: 14 }}>
            <ArrowLeft size={14} aria-hidden="true" /> Notícias
          </Link>
          <div className="article__meta">
            <Link to={article.category.slug === 'oficial' ? '/oficiais' : article.category.slug === 'rumores' ? '/rumores' : `/noticias?categoria=${article.category.slug}`} className="badge badge--category" style={{ textDecoration: 'none' }}>
              {article.category.name}
            </Link>
            <StatusBadge status={article.verificationStatus} />
          </div>
          <h1>{article.title}</h1>
          <p className="article__lead">{article.summary}</p>
          <div className="article__meta">
            <span className="row" style={{ gap: 6 }}>
              <UserRound size={15} aria-hidden="true" /> {article.authorName}
            </span>
            <span>
              Publicado em <time dateTime={article.publishedAt}>{formatDate(article.publishedAt)}</time>
            </span>
            {article.updatedAt !== article.publishedAt && (
              <span>
                Atualizado em <time dateTime={article.updatedAt}>{formatDateTime(article.updatedAt)}</time>
              </span>
            )}
            <span className="row" style={{ gap: 6 }}>
              <Clock size={15} aria-hidden="true" /> {article.readingMinutes} min de leitura
            </span>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => void share()}>
              <Share2 size={14} aria-hidden="true" /> Compartilhar
            </button>
          </div>
        </header>

        <div className="article__cover">{article.coverUrl ? <img src={article.coverUrl} alt={article.coverAlt ?? ''} /> : <NeonScene seed={article.slug} title="Ilustração original do portal" />}</div>
        {!article.coverUrl && <p className="muted small" style={{ marginTop: -12 }}>Ilustração original do portal. Não é material oficial do jogo.</p>}

        {article.verificationStatus !== 'confirmed' && <StatusExplainer status={article.verificationStatus} />}

        <div className="prose" dangerouslySetInnerHTML={{ __html: html }} />

        {article.claims.length > 0 && (
          <section className="sources" aria-labelledby="claims-h">
            <h2 id="claims-h">O que é fato e o que não é</h2>
            <div style={{ overflowX: 'auto' }}>
              <table className="claims">
                <thead>
                  <tr>
                    <th scope="col">Afirmação</th>
                    <th scope="col">Status</th>
                    <th scope="col">Fonte</th>
                  </tr>
                </thead>
                <tbody>
                  {article.claims.map((c, i) => (
                    <tr key={i}>
                      <td>{c.text}</td>
                      <td>
                        <StatusBadge status={c.status} />
                      </td>
                      <td>
                        {c.sourceUrl ? (
                          <a href={c.sourceUrl} target="_blank" rel="noopener noreferrer">
                            {new URL(c.sourceUrl).hostname.replace(/^www\./, '')}
                          </a>
                        ) : (
                          <span className="muted">{c.status === 'theory' ? 'Análise editorial' : '—'}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <section className="sources" aria-labelledby="sources-h">
          <h2 id="sources-h">Fontes e referências</h2>
          {article.sources.length ? (
            <ol>
              {article.sources.map((s) => (
                <li key={s.url}>
                  <a href={s.url} target="_blank" rel="noopener noreferrer">
                    {s.title}
                  </a>{' '}
                  <span className="publisher">
                    — {s.publisher}
                    {s.isPrimary ? ' (fonte principal)' : ''}
                    {s.publishedAt ? `, ${formatDate(s.publishedAt)}` : ''}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="muted">Texto de análise da redação.</p>
          )}
          <p className="small muted">
            Status de verificação: <strong>{VERIFICATION_LABELS[article.verificationStatus]}</strong>.{' '}
            {article.approvedAt ? `Revisado pela redação em ${formatDate(article.approvedAt)}.` : ''}{' '}
            {article.aiAssisted ? 'Texto produzido com apoio de ferramentas de IA e revisado por pessoas.' : ''} Encontrou um erro?{' '}
            <Link to="/contato">Fale com a redação</Link>.
          </p>
          {article.tags.length > 0 && (
            <div className="tags" style={{ marginTop: 14 }}>
              {article.tags.map((t) => (
                <Link key={t} className="tag" to={`/noticias?tag=${encodeURIComponent(t)}`}>
                  #{t}
                </Link>
              ))}
            </div>
          )}
        </section>

        {site.data && site.data.channels.length > 0 && (
          <div style={{ marginTop: 32 }}>
            <ChannelsCta channels={site.data.channels} placement={`article:${article.slug}`} title="Receba as próximas atualizações de GTA VI" />
          </div>
        )}
      </article>

      {related.length > 0 && (
        <section className="section" aria-labelledby="related-h">
          <h2 id="related-h">Leia também</h2>
          <div className="grid grid--3">
            {related.map((a) => (
              <ArticleCard key={a.slug} article={a} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
