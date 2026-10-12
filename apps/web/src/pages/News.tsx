import { useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { Search } from 'lucide-react';
import { VERIFICATION_LABELS, VERIFICATION_STATUSES, type PublicArticleSummary, type VerificationStatus } from '@pgi/shared';
import { ArticleCard, ChannelsCta } from '../components/cards.tsx';
import { Empty, ErrorState, Loading, Pagination } from '../components/ui.tsx';
import { useSite } from '../lib/data.ts';
import { useSeo } from '../lib/seo.ts';

const PAGE_SIZE = 9;

function normalize(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export interface NewsListProps {
  path: string;
  title: string;
  description: string;
  /** Filtro fixo da página (ex.: só oficiais). */
  scope?: (a: PublicArticleSummary) => boolean;
  /** Mostrar filtro por categoria. */
  categoryFilter?: boolean;
  notice?: React.ReactNode;
}

export function NewsList({ path, title, description, scope, categoryFilter = true, notice }: NewsListProps) {
  const { data, isLoading, isError, refetch } = useSite();
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const cat = params.get('categoria') ?? '';
  const status = (params.get('status') ?? '') as VerificationStatus | '';
  const tag = params.get('tag') ?? '';
  const page = Math.max(1, Number(params.get('pagina') ?? 1) || 1);

  useSeo(data ? { title, description, path, siteName: data.settings.siteName } : null);

  const filtered = useMemo(() => {
    if (!data) return [];
    const nq = normalize(q.trim());
    return data.articles.filter(
      (a) =>
        (!scope || scope(a)) &&
        (!cat || a.category.slug === cat) &&
        (!status || a.verificationStatus === status) &&
        (!tag || a.tags.includes(tag)) &&
        (!nq || normalize(`${a.title} ${a.summary} ${a.tags.join(' ')}`).includes(nq)),
    );
  }, [data, q, cat, status, tag, scope]);

  const set = (k: string, v: string) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    if (k !== 'pagina') next.delete('pagina');
    setParams(next, { replace: true });
  };

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const slice = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const statusesPresent = data ? VERIFICATION_STATUSES.filter((s) => data.articles.some((a) => (!scope || scope(a)) && a.verificationStatus === s)) : [];

  return (
    <div className="container">
      <header className="page-hero">
        <h1>{title}</h1>
        <p className="lead">{description}</p>
        {notice}
      </header>

      <div className="filters">
        <div className="header-search" style={{ width: 280 }}>
          <Search size={16} aria-hidden="true" />
          <label htmlFor="news-q" className="sr-only">
            Filtrar por palavra-chave
          </label>
          <input id="news-q" type="search" placeholder="Filtrar por palavra-chave…" value={q} onChange={(e) => set('q', e.target.value)} maxLength={120} />
        </div>
        {categoryFilter && data && (
          <>
            <button type="button" className="chip" aria-pressed={!cat} onClick={() => set('categoria', '')}>
              Todas
            </button>
            {data.categories.map((c) => (
              <button key={c.slug} type="button" className="chip" aria-pressed={cat === c.slug} onClick={() => set('categoria', cat === c.slug ? '' : c.slug)}>
                {c.name}
              </button>
            ))}
          </>
        )}
        {statusesPresent.length > 1 && (
          <div className="field" style={{ margin: 0, minWidth: 180 }}>
            <label htmlFor="news-status" className="sr-only">
              Status de verificação
            </label>
            <select id="news-status" value={status} onChange={(e) => set('status', e.target.value)}>
              <option value="">Qualquer status</option>
              {statusesPresent.map((s) => (
                <option key={s} value={s}>
                  {VERIFICATION_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
        )}
        {tag && (
          <button type="button" className="chip" aria-pressed="true" onClick={() => set('tag', '')}>
            #{tag} ✕
          </button>
        )}
      </div>

      {isLoading ? (
        <Loading cards={6} />
      ) : isError || !data ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : slice.length === 0 ? (
        <Empty title="Nenhum resultado">
          {q || cat || status || tag ? 'Tente remover algum filtro ou buscar por outro termo.' : 'Ainda não há publicações nesta seção.'}
        </Empty>
      ) : (
        <>
          <p className="muted small" aria-live="polite">
            {filtered.length} {filtered.length === 1 ? 'publicação' : 'publicações'}
          </p>
          <div className="grid grid--3">
            {slice.map((a) => (
              <ArticleCard key={a.slug} article={a} headingLevel={2} />
            ))}
          </div>
          <Pagination page={current} pages={pages} onPage={(p) => set('pagina', String(p))} />
        </>
      )}

      {data && data.channels.length > 0 && (
        <div className="section">
          <ChannelsCta channels={data.channels} placement={`list:${path}`} />
        </div>
      )}
    </div>
  );
}

export const NewsPage = () => <NewsList path="/noticias" title="Notícias" description="Toda a cobertura sobre GTA VI, com fonte, data e status de verificação em cada publicação." />;

export const OfficialPage = () => (
  <NewsList
    path="/oficiais"
    title="Notícias oficiais"
    description="Anúncios e materiais publicados pela Rockstar Games e por fontes primárias."
    scope={(a) => a.category.slug === 'oficial'}
    categoryFilter={false}
  />
);

export const RumorsPage = () => (
  <NewsList
    path="/rumores"
    title="Rumores e teorias"
    description="Informações não confirmadas, vazamentos e análises especulativas, sempre identificados como tal."
    scope={(a) => a.category.slug === 'rumores' || ['rumor', 'theory', 'debunked'].includes(a.verificationStatus)}
    categoryFilter={false}
    notice={
      <div className="alert alert--warn" role="note">
        Nada nesta seção é informação oficial. Rumores podem ser desmentidos, e nós atualizamos o status quando isso acontece. Não publicamos material
        confidencial vazado nem dados pessoais.
      </div>
    }
  />
);
