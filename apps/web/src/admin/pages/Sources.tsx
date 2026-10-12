import { useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router';
import { Play, Plus, RefreshCw } from 'lucide-react';
import {
  SOURCE_METHOD_LABELS,
  SOURCE_METHODS,
  SOURCE_TYPE_LABELS,
  SOURCE_TYPES,
  type SourceMethod,
  type SourceType,
} from '@pgi/shared';
import { formatDateTime } from '../../lib/format.ts';
import { useAuth } from '../AdminApp.tsx';
import { api, useApiMutation, useApiQuery } from '../api.ts';
import { ConfirmButton, Dialog, Feedback, Field, Pill, StringList } from '../form.tsx';
import { runTone } from './Dashboard.tsx';

interface Source {
  id: number;
  name: string;
  siteUrl: string;
  feedUrl: string | null;
  type: SourceType;
  method: SourceMethod;
  reliability: number;
  enabled: boolean;
  keywords: string[];
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  lastStatus: string;
  lastError: string | null;
  consecutiveFailures: number;
  notes: string | null;
  itemCount: number;
}

type SourceForm = Omit<Source, 'id' | 'lastRunAt' | 'lastSuccessAt' | 'lastStatus' | 'lastError' | 'consecutiveFailures' | 'itemCount'>;
const blank: SourceForm = { name: '', siteUrl: '', feedUrl: '', type: 'press', method: 'rss', reliability: 3, enabled: true, keywords: ['gta 6', 'gta vi', 'grand theft auto vi'], notes: '' };

function SourceDialog({ initial, id, onClose }: { initial: SourceForm; id?: number; onClose: () => void }) {
  const [f, setF] = useState<SourceForm>(initial);
  const save = useApiMutation(
    () => api(id ? `/sources/${id}` : '/sources', { method: id ? 'PUT' : 'POST', json: { ...f, feedUrl: f.feedUrl || null, notes: f.notes || null } }),
    [['sources']],
  );
  const submit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate(undefined, { onSuccess: onClose });
  };
  return (
    <Dialog title={id ? 'Editar fonte' : 'Nova fonte'} onClose={onClose}>
      <form onSubmit={submit}>
        <Feedback error={save.error} />
        <div className="form-grid">
          <Field label="Nome" htmlFor="src-name">
            <input id="src-name" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          </Field>
          <Field label="Site" htmlFor="src-site">
            <input id="src-site" type="url" required value={f.siteUrl} onChange={(e) => setF({ ...f, siteUrl: e.target.value })} />
          </Field>
          <Field label="Tipo" htmlFor="src-type">
            <select id="src-type" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as SourceType })}>
              {SOURCE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {SOURCE_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Método de coleta" htmlFor="src-method">
            <select id="src-method" value={f.method} onChange={(e) => setF({ ...f, method: e.target.value as SourceMethod })}>
              {SOURCE_METHODS.map((m) => (
                <option key={m} value={m} disabled={m === 'api' || m === 'page'}>
                  {SOURCE_METHOD_LABELS[m]}
                  {m === 'api' || m === 'page' ? ' (coletor ainda não implementado)' : ''}
                </option>
              ))}
            </select>
          </Field>
          <Field label="URL do feed" htmlFor="src-feed" hint="Obrigatório para RSS. Confira os termos de uso da fonte." className="span-2">
            <input id="src-feed" type="url" value={f.feedUrl ?? ''} onChange={(e) => setF({ ...f, feedUrl: e.target.value })} required={f.method === 'rss'} />
          </Field>
          <Field label="Confiabilidade (1 a 5)" htmlFor="src-rel">
            <input id="src-rel" type="number" min={1} max={5} value={f.reliability} onChange={(e) => setF({ ...f, reliability: Number(e.target.value) })} />
          </Field>
          <div className="field">
            <span className="label">Status</span>
            <label className="check">
              <input type="checkbox" checked={f.enabled} onChange={(e) => setF({ ...f, enabled: e.target.checked })} /> Ativa
            </label>
          </div>
        </div>
        <StringList id="src-kw" label="Palavras-chave exigidas (vazio = aceitar todos os itens)" values={f.keywords} onChange={(keywords) => setF({ ...f, keywords })} />
        <Field label="Observações" htmlFor="src-notes">
          <textarea id="src-notes" value={f.notes ?? ''} onChange={(e) => setF({ ...f, notes: e.target.value })} />
        </Field>
        <button type="submit" className="btn btn--primary" disabled={save.isPending}>
          Salvar
        </button>
      </form>
    </Dialog>
  );
}

export function SourcesPage() {
  const { can } = useAuth();
  const q = useApiQuery<Source[]>(['sources'], '/sources');
  const [editing, setEditing] = useState<{ id?: number; f: SourceForm } | null>(null);
  const run = useApiMutation((sourceId?: number) => api<{ runId: number }>('/pipeline/run', { method: 'POST', json: sourceId ? { sourceId } : {} }), [['sources'], ['runs'], ['queue'], ['dashboard']]);
  const del = useApiMutation((id: number) => api(`/sources/${id}`, { method: 'DELETE' }), [['sources']]);

  return (
    <>
      <div className="admin-head">
        <div>
          <h1>Fontes monitoradas</h1>
          <p>Feeds e páginas acompanhados pela pipeline. Fontes oficiais sem feed ficam como acompanhamento manual.</p>
        </div>
        <div className="row">
          {can('pipeline:run') && (
            <button type="button" className="btn btn--cyan" disabled={run.isPending} onClick={() => run.mutate(undefined)}>
              <Play size={16} aria-hidden="true" /> {run.isPending ? 'Coletando…' : 'Coletar agora'}
            </button>
          )}
          {can('sources:write') && (
            <button type="button" className="btn btn--primary" onClick={() => setEditing({ f: blank })}>
              <Plus size={16} aria-hidden="true" /> Nova fonte
            </button>
          )}
        </div>
      </div>
      <Feedback error={q.error ?? run.error ?? del.error} success={run.data ? `Coleta #${run.data.runId} concluída. Veja os detalhes em “Execuções e logs”.` : null} />
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Fonte</th>
              <th>Tipo / método</th>
              <th>Confiab.</th>
              <th>Última execução</th>
              <th>Status</th>
              <th className="num">Itens</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {q.data?.map((s) => (
              <tr key={s.id}>
                <td>
                  <a href={s.siteUrl} target="_blank" rel="noopener noreferrer">
                    {s.name}
                  </a>
                  {!s.enabled && <> <Pill>desativada</Pill></>}
                  {s.notes && <div className="small muted">{s.notes}</div>}
                </td>
                <td className="small">
                  {SOURCE_TYPE_LABELS[s.type]}
                  <br />
                  {SOURCE_METHOD_LABELS[s.method]}
                </td>
                <td className="num">{s.reliability}</td>
                <td className="small">{s.lastRunAt ? formatDateTime(s.lastRunAt) : 'nunca'}</td>
                <td>
                  <Pill tone={s.lastStatus === 'ok' ? 'ok' : s.lastStatus === 'error' ? 'err' : undefined}>{s.lastStatus}</Pill>
                  {s.lastError && <div className="small" style={{ color: '#ffb4b4' }}>{s.lastError}</div>}
                </td>
                <td className="num">{s.itemCount}</td>
                <td>
                  <div className="actions">
                    {can('pipeline:run') && s.method === 'rss' && (
                      <button type="button" className="btn btn--ghost btn--sm" disabled={run.isPending} onClick={() => run.mutate(s.id)} title="Reprocessar só esta fonte">
                        <RefreshCw size={14} aria-hidden="true" /> Reprocessar
                      </button>
                    )}
                    {can('sources:write') && (
                      <button type="button" className="btn btn--ghost btn--sm" onClick={() => setEditing({ id: s.id, f: { name: s.name, siteUrl: s.siteUrl, feedUrl: s.feedUrl, type: s.type, method: s.method, reliability: s.reliability, enabled: s.enabled, keywords: s.keywords, notes: s.notes } })}>
                        Editar
                      </button>
                    )}
                    {can('sources:write') && s.itemCount === 0 && (
                      <ConfirmButton message={`Excluir a fonte ${s.name}?`} onConfirm={() => del.mutate(s.id)}>
                        Excluir
                      </ConfirmButton>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editing && <SourceDialog initial={editing.f} id={editing.id} onClose={() => setEditing(null)} />}
    </>
  );
}

interface Run {
  id: number;
  kind: string;
  status: string;
  trigger: string;
  startedAt: string;
  finishedAt: string | null;
  stats: Record<string, number>;
  error: string | null;
}

export function PipelinePage() {
  const [params, setParams] = useSearchParams();
  const selected = params.get('run');
  const runs = useApiQuery<Run[]>(['runs'], '/pipeline/runs');
  const detail = useApiQuery<{ run: Run; logs: { id: number; level: string; message: string; sourceName: string | null; createdAt: string }[] }>(['run', selected], `/pipeline/runs/${selected}`, Boolean(selected));
  return (
    <>
      <div className="admin-head">
        <div>
          <h1>Execuções e logs</h1>
          <p>Histórico da coleta (agendada pelo GitHub Actions ou manual). Uma fonte com falha não afeta as outras, e os itens já coletados são preservados.</p>
        </div>
      </div>
      <Feedback error={runs.error} />
      <div className="split">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>#</th>
                <th>Início</th>
                <th>Origem</th>
                <th>Status</th>
                <th className="num">Novos</th>
                <th className="num">Falhas</th>
              </tr>
            </thead>
            <tbody>
              {runs.data?.map((r) => (
                <tr key={r.id} style={{ background: String(r.id) === selected ? 'var(--surface-2)' : undefined }}>
                  <td>
                    <button type="button" className="btn btn--ghost btn--sm" onClick={() => setParams({ run: String(r.id) })}>
                      #{r.id}
                    </button>
                  </td>
                  <td className="small">{formatDateTime(r.startedAt)}</td>
                  <td className="small">{r.trigger}</td>
                  <td>
                    <Pill tone={runTone(r.status)}>{r.status}</Pill>
                  </td>
                  <td className="num">{r.stats.inserted ?? 0}</td>
                  <td className="num">{r.stats.failed ?? 0}</td>
                </tr>
              ))}
              {runs.data?.length === 0 && (
                <tr>
                  <td colSpan={6} className="muted">
                    Nenhuma execução registrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <section className="panel" aria-label="Logs da execução">
          {!selected ? (
            <p className="muted">Selecione uma execução para ver os logs.</p>
          ) : detail.isLoading ? (
            <p role="status">Carregando…</p>
          ) : detail.data ? (
            <>
              <h2 style={{ fontSize: '1.05rem' }}>Execução #{detail.data.run.id}</h2>
              <p className="small muted">{Object.entries(detail.data.run.stats).map(([k, v]) => `${k}: ${v}`).join(' · ')}</p>
              <ul className="list-plain stack small">
                {detail.data.logs.map((l) => (
                  <li key={l.id}>
                    <Pill tone={l.level === 'error' ? 'err' : l.level === 'warn' ? 'warn' : undefined}>{l.level}</Pill> <strong>{l.sourceName ?? 'geral'}</strong>: {l.message}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <Feedback error={detail.error} />
          )}
        </section>
      </div>
    </>
  );
}
