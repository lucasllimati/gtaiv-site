import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ExternalLink, FilePlus2, EyeOff, RotateCcw } from 'lucide-react';
import { SOURCE_TYPE_LABELS, type SourceType, type VerificationStatus } from '@pgi/shared';
import { StatusBadge } from '../../components/ui.tsx';
import { formatDateTime } from '../../lib/format.ts';
import { useAuth } from '../AdminApp.tsx';
import { api, useApiMutation, useApiQuery } from '../api.ts';
import { Feedback, Pill } from '../form.tsx';

interface Item {
  id: number;
  title: string;
  url: string;
  excerpt: string | null;
  publishedAt: string | null;
  collectedAt: string;
  topics: string[];
  flags: string[];
  suggestedStatus: VerificationStatus;
  status: string;
  articleId: number | null;
  sourceName: string;
  sourceType: SourceType;
  reliability: number;
  duplicateOf: { id: number; title: string; url: string } | null;
}

const TABS = [
  { k: 'new', label: 'Novos' },
  { k: 'duplicate', label: 'Possíveis duplicatas' },
  { k: 'drafted', label: 'Com rascunho' },
  { k: 'ignored', label: 'Ignorados' },
];

export function Queue() {
  const { can } = useAuth();
  const [tab, setTab] = useState('new');
  const [page, setPage] = useState(1);
  const navigate = useNavigate();
  const q = useApiQuery<{ items: Item[]; total: number; pageSize: number }>(['queue', tab, page], `/source-items?status=${tab}&page=${page}&pageSize=25`);
  const setStatus = useApiMutation((b: { id: number; status: 'new' | 'ignored' }) => api(`/source-items/${b.id}/status`, { method: 'POST', json: { status: b.status } }), [['queue'], ['dashboard']]);
  const draft = useApiMutation((id: number) => api<{ articleId: number; generator: string }>(`/source-items/${id}/draft`, { method: 'POST', json: {} }), [['queue'], ['dashboard'], ['articles']]);
  const pages = q.data ? Math.max(1, Math.ceil(q.data.total / q.data.pageSize)) : 1;

  return (
    <>
      <div className="admin-head">
        <div>
          <h1>Fila de revisão</h1>
          <p>Publicações coletadas das fontes. Gere um rascunho para revisão ou ignore o item. Nada é publicado automaticamente.</p>
        </div>
      </div>
      <div className="filters" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.k}
            type="button"
            role="tab"
            className="chip"
            aria-selected={tab === t.k}
            aria-pressed={tab === t.k}
            onClick={() => {
              setTab(t.k);
              setPage(1);
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      <Feedback error={q.error ?? setStatus.error ?? draft.error} success={draft.data ? `Rascunho criado (${draft.data.generator === 'ai' ? 'com IA' : 'modelo sem IA'}).` : null} />
      {q.isLoading && <p role="status">Carregando…</p>}
      {q.data && q.data.items.length === 0 && <div className="state">Nada por aqui.</div>}
      <div className="stack">
        {q.data?.items.map((it) => (
          <article key={it.id} className="panel">
            <div className="row" style={{ marginBottom: 6 }}>
              <Pill>{it.sourceName}</Pill>
              <Pill tone={it.sourceType === 'official' ? 'ok' : it.sourceType === 'community' ? 'warn' : undefined}>{SOURCE_TYPE_LABELS[it.sourceType]}</Pill>
              <StatusBadge status={it.suggestedStatus} />
              {it.flags.map((f) => (
                <Pill key={f} tone="warn">
                  {f}
                </Pill>
              ))}
              <span className="spacer" />
              <span className="muted small">
                {it.publishedAt ? `Publicado ${formatDateTime(it.publishedAt)}` : 'Sem data'} · coletado {formatDateTime(it.collectedAt)}
              </span>
            </div>
            <h2 style={{ fontSize: '1.05rem', margin: '4px 0' }}>{it.title}</h2>
            {it.excerpt && <p className="small muted">{it.excerpt}</p>}
            {it.topics.length > 0 && <p className="small">Assuntos: {it.topics.join(', ')}</p>}
            {it.duplicateOf && (
              <p className="small alert alert--warn">
                Semelhante a: <a href={it.duplicateOf.url} target="_blank" rel="noopener noreferrer">{it.duplicateOf.title}</a>
              </p>
            )}
            <div className="row">
              <a className="btn btn--ghost btn--sm" href={it.url} target="_blank" rel="noopener noreferrer">
                <ExternalLink size={14} aria-hidden="true" /> Abrir fonte
              </a>
              {it.articleId ? (
                <Link className="btn btn--cyan btn--sm" to={`../artigos/${it.articleId}`}>
                  Abrir rascunho
                </Link>
              ) : (
                can('articles:write') && (
                  <button
                    type="button"
                    className="btn btn--primary btn--sm"
                    disabled={draft.isPending}
                    onClick={() => draft.mutate(it.id, { onSuccess: (r) => navigate(`../artigos/${r.articleId}`) })}
                  >
                    <FilePlus2 size={14} aria-hidden="true" /> {draft.isPending && draft.variables === it.id ? 'Gerando…' : 'Gerar rascunho'}
                  </button>
                )
              )}
              {can('articles:write') && it.status !== 'drafted' && (
                it.status === 'ignored' ? (
                  <button type="button" className="btn btn--ghost btn--sm" onClick={() => setStatus.mutate({ id: it.id, status: 'new' })}>
                    <RotateCcw size={14} aria-hidden="true" /> Restaurar
                  </button>
                ) : (
                  <button type="button" className="btn btn--ghost btn--sm" onClick={() => setStatus.mutate({ id: it.id, status: 'ignored' })}>
                    <EyeOff size={14} aria-hidden="true" /> Ignorar
                  </button>
                )
              )}
            </div>
          </article>
        ))}
      </div>
      {pages > 1 && (
        <div className="pagination">
          <button type="button" className="btn btn--ghost btn--sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Anterior
          </button>
          <span>
            {page}/{pages}
          </span>
          <button type="button" className="btn btn--ghost btn--sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>
            Próxima
          </button>
        </div>
      )}
    </>
  );
}
