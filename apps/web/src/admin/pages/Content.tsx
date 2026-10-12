import { useState, type FormEvent } from 'react';
import { Plus } from 'lucide-react';
import {
  DISCOVERY_KIND_LABELS,
  DISCOVERY_KINDS,
  GUIDE_KIND_LABELS,
  GUIDE_KINDS,
  type DiscoveryKind,
  type GuideKind,
  type VerificationStatus,
} from '@pgi/shared';
import { StatusBadge } from '../../components/ui.tsx';
import { formatDate, formatDateTime } from '../../lib/format.ts';
import { useAuth } from '../AdminApp.tsx';
import { api, fromLocalInput, toLocalInput, useApiMutation, useApiQuery } from '../api.ts';
import { ConfirmButton, Dialog, Feedback, Field, LinkList, Pill, StatusSelect, StringList } from '../form.tsx';

interface GuideEntry {
  id: number;
  kind: GuideKind;
  slug: string;
  title: string;
  summary: string;
  body: string;
  verificationStatus: VerificationStatus;
  eventDate: string | null;
  sortOrder: number;
  sources: { url: string; label: string }[];
  published: boolean;
  updatedAt: string;
}
type GuideForm = Omit<GuideEntry, 'id' | 'updatedAt'>;

function GuideDialog({ initial, id, onClose }: { initial: GuideForm; id?: number; onClose: () => void }) {
  const [f, setF] = useState(initial);
  const save = useApiMutation(() => api(id ? `/guide/${id}` : '/guide', { method: id ? 'PUT' : 'POST', json: { ...f, slug: f.slug || undefined, eventDate: f.eventDate || null, sources: f.sources.filter((s) => s.url) } }), [['guide']]);
  return (
    <Dialog title={id ? 'Editar item do guia' : 'Novo item do guia'} onClose={onClose}>
      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          save.mutate(undefined, { onSuccess: onClose });
        }}
      >
        <Feedback error={save.error} />
        <div className="form-grid">
          <Field label="Seção" htmlFor="g-kind">
            <select id="g-kind" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as GuideKind })}>
              {GUIDE_KINDS.map((k) => (
                <option key={k} value={k}>
                  {GUIDE_KIND_LABELS[k]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Status de verificação" htmlFor="g-status">
            <StatusSelect id="g-status" value={f.verificationStatus} onChange={(v) => setF({ ...f, verificationStatus: v })} />
          </Field>
          <Field label="Título" htmlFor="g-title" className="span-2">
            <input id="g-title" required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
          </Field>
          {f.kind === 'history' && (
            <Field label="Data do evento" htmlFor="g-date">
              <input id="g-date" type="date" value={f.eventDate ?? ''} onChange={(e) => setF({ ...f, eventDate: e.target.value })} />
            </Field>
          )}
          <Field label="Ordem" htmlFor="g-order">
            <input id="g-order" type="number" min={0} value={f.sortOrder} onChange={(e) => setF({ ...f, sortOrder: Number(e.target.value) })} />
          </Field>
        </div>
        <Field label="Resumo" htmlFor="g-summary">
          <textarea id="g-summary" required minLength={10} maxLength={500} value={f.summary} onChange={(e) => setF({ ...f, summary: e.target.value })} />
        </Field>
        <Field label="Texto complementar (Markdown, opcional)" htmlFor="g-body">
          <textarea id="g-body" value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} />
        </Field>
        <LinkList idPrefix="g-src" label="Fontes" values={f.sources} onChange={(sources) => setF({ ...f, sources })} />
        <label className="check" style={{ marginBottom: 14 }}>
          <input type="checkbox" checked={f.published} onChange={(e) => setF({ ...f, published: e.target.checked })} /> Publicado no site
        </label>
        <div>
          <button type="submit" className="btn btn--primary" disabled={save.isPending}>
            Salvar
          </button>
        </div>
      </form>
    </Dialog>
  );
}

export function GuideAdmin() {
  const { can } = useAuth();
  const q = useApiQuery<GuideEntry[]>(['guide'], '/guide');
  const [kind, setKind] = useState<GuideKind>('character');
  const [editing, setEditing] = useState<{ id?: number; f: GuideForm } | null>(null);
  const del = useApiMutation((id: number) => api(`/guide/${id}`, { method: 'DELETE' }), [['guide']]);
  const items = q.data?.filter((g) => g.kind === kind) ?? [];
  return (
    <>
      <div className="admin-head">
        <div>
          <h1>Guia do universo</h1>
          <p>História, personagens, locais, veículos, atividades e FAQ. Publique apenas informações sustentadas por fonte.</p>
        </div>
        {can('articles:write') && (
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => setEditing({ f: { kind, slug: '', title: '', summary: '', body: '', verificationStatus: 'confirmed', eventDate: null, sortOrder: items.length + 1, sources: [], published: false } })}
          >
            <Plus size={16} aria-hidden="true" /> Novo item
          </button>
        )}
      </div>
      <div className="filters">
        {GUIDE_KINDS.map((k) => (
          <button key={k} type="button" className="chip" aria-pressed={kind === k} onClick={() => setKind(k)}>
            {GUIDE_KIND_LABELS[k]} ({q.data?.filter((g) => g.kind === k).length ?? 0})
          </button>
        ))}
      </div>
      <Feedback error={q.error ?? del.error} />
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Título</th>
              <th>Status</th>
              <th>Publicado</th>
              <th>Atualizado</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {items.map((g) => (
              <tr key={g.id}>
                <td>
                  {g.title}
                  {g.eventDate && <div className="small muted">{formatDate(g.eventDate)}</div>}
                </td>
                <td>
                  <StatusBadge status={g.verificationStatus} />
                </td>
                <td>{g.published ? <Pill tone="ok">sim</Pill> : <Pill>não</Pill>}</td>
                <td className="small muted">{formatDateTime(g.updatedAt)}</td>
                <td>
                  <div className="actions">
                    {can('articles:write') && (
                      <button type="button" className="btn btn--ghost btn--sm" onClick={() => setEditing({ id: g.id, f: { kind: g.kind, slug: g.slug, title: g.title, summary: g.summary, body: g.body, verificationStatus: g.verificationStatus, eventDate: g.eventDate, sortOrder: g.sortOrder, sources: g.sources, published: g.published } })}>
                        Editar
                      </button>
                    )}
                    {can('articles:publish') && (
                      <ConfirmButton message={`Excluir “${g.title}”?`} onConfirm={() => del.mutate(g.id)}>
                        Excluir
                      </ConfirmButton>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={5} className="muted">
                  Nenhum item nesta seção. O site mostra um aviso de “ainda não confirmado”.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {editing && <GuideDialog initial={editing.f} id={editing.id} onClose={() => setEditing(null)} />}
    </>
  );
}

interface Discovery {
  id: number;
  slug: string;
  title: string;
  kind: DiscoveryKind;
  description: string;
  gameVersion: string | null;
  platforms: string[];
  steps: string[];
  evidence: { url: string; label: string }[];
  sourceUrl: string | null;
  verificationStatus: VerificationStatus;
  lastConfirmedAt: string | null;
  riskWarning: string | null;
  fixedInVersion: string | null;
  history: { at: string; by: string; note: string }[];
  published: boolean;
  updatedAt: string;
}
type DiscoveryForm = Omit<Discovery, 'id' | 'history' | 'updatedAt'> & { changeNote: string };

function DiscoveryDialog({ initial, current, onClose }: { initial: DiscoveryForm; current?: Discovery; onClose: () => void }) {
  const [f, setF] = useState(initial);
  const save = useApiMutation(() => {
    const { changeNote, ...rest } = f;
    const body = { ...rest, slug: rest.slug || undefined, sourceUrl: rest.sourceUrl || null, gameVersion: rest.gameVersion || null, riskWarning: rest.riskWarning || null, fixedInVersion: rest.fixedInVersion || null, evidence: rest.evidence.filter((e) => e.url) };
    return current ? api(`/discoveries/${current.id}`, { method: 'PUT', json: { ...body, changeNote } }) : api('/discoveries', { method: 'POST', json: body });
  }, [['discoveries']]);
  return (
    <Dialog title={current ? 'Editar descoberta' : 'Nova descoberta'} onClose={onClose}>
      <div className="alert alert--warn small">Não registre glitches sem evidência. Antes do lançamento, só materiais públicos verificáveis, identificados como análise.</div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate(undefined, { onSuccess: onClose });
        }}
      >
        <Feedback error={save.error} />
        <div className="form-grid">
          <Field label="Título" htmlFor="d-title" className="span-2">
            <input id="d-title" required minLength={5} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
          </Field>
          <Field label="Categoria" htmlFor="d-kind">
            <select id="d-kind" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as DiscoveryKind })}>
              {DISCOVERY_KINDS.map((k) => (
                <option key={k} value={k}>
                  {DISCOVERY_KIND_LABELS[k]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Status de verificação" htmlFor="d-status">
            <StatusSelect id="d-status" value={f.verificationStatus} onChange={(v) => setF({ ...f, verificationStatus: v })} />
          </Field>
          <Field label="Versão do jogo" htmlFor="d-ver">
            <input id="d-ver" value={f.gameVersion ?? ''} onChange={(e) => setF({ ...f, gameVersion: e.target.value })} placeholder="ex.: 1.02" />
          </Field>
          <Field label="Corrigido na versão" htmlFor="d-fixed">
            <input id="d-fixed" value={f.fixedInVersion ?? ''} onChange={(e) => setF({ ...f, fixedInVersion: e.target.value })} />
          </Field>
          <Field label="Última confirmação" htmlFor="d-confirmed">
            <input id="d-confirmed" type="datetime-local" value={toLocalInput(f.lastConfirmedAt)} onChange={(e) => setF({ ...f, lastConfirmedAt: fromLocalInput(e.target.value) })} />
          </Field>
          <Field label="Fonte original (URL)" htmlFor="d-src">
            <input id="d-src" type="url" value={f.sourceUrl ?? ''} onChange={(e) => setF({ ...f, sourceUrl: e.target.value })} />
          </Field>
        </div>
        <Field label="Descrição" htmlFor="d-desc">
          <textarea id="d-desc" required minLength={20} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
        </Field>
        <StringList id="d-plat" label="Plataformas" values={f.platforms} onChange={(platforms) => setF({ ...f, platforms })} placeholder="PS5" />
        <StringList id="d-steps" label="Passos de reprodução" values={f.steps} onChange={(steps) => setF({ ...f, steps })} />
        <LinkList idPrefix="d-ev" label="Evidências (vídeos, capturas, posts)" values={f.evidence} onChange={(evidence) => setF({ ...f, evidence })} />
        <Field label="Aviso de risco (perda de progresso, instabilidade…)" htmlFor="d-risk">
          <input id="d-risk" value={f.riskWarning ?? ''} onChange={(e) => setF({ ...f, riskWarning: e.target.value })} />
        </Field>
        {current && (
          <Field label="O que mudou nesta edição? (registrado no histórico)" htmlFor="d-note">
            <input id="d-note" required minLength={3} value={f.changeNote} onChange={(e) => setF({ ...f, changeNote: e.target.value })} />
          </Field>
        )}
        <label className="check" style={{ marginBottom: 14 }}>
          <input type="checkbox" checked={f.published} onChange={(e) => setF({ ...f, published: e.target.checked })} /> Publicado no site
        </label>
        <div>
          <button type="submit" className="btn btn--primary" disabled={save.isPending}>
            Salvar
          </button>
        </div>
        {current && current.history.length > 0 && (
          <>
            <h3 style={{ marginTop: 20 }}>Histórico</h3>
            <ul className="small muted">
              {current.history.map((h, i) => (
                <li key={i}>
                  {formatDateTime(h.at)} — {h.by}: {h.note}
                </li>
              ))}
            </ul>
          </>
        )}
      </form>
    </Dialog>
  );
}

export function DiscoveriesAdmin() {
  const { can } = useAuth();
  const q = useApiQuery<Discovery[]>(['discoveries'], '/discoveries');
  const [editing, setEditing] = useState<{ current?: Discovery; f: DiscoveryForm } | null>(null);
  const del = useApiMutation((id: number) => api(`/discoveries/${id}`, { method: 'DELETE' }), [['discoveries']]);
  const blank: DiscoveryForm = { slug: '', title: '', kind: 'secret', description: '', gameVersion: '', platforms: [], steps: [], evidence: [], sourceUrl: '', verificationStatus: 'in_review', lastConfirmedAt: null, riskWarning: '', fixedInVersion: '', published: false, changeNote: '' };
  return (
    <>
      <div className="admin-head">
        <div>
          <h1>Glitches, segredos e descobertas</h1>
          <p>Base de descobertas com evidências, versão, plataforma e histórico.</p>
        </div>
        {can('articles:write') && (
          <button type="button" className="btn btn--primary" onClick={() => setEditing({ f: blank })}>
            <Plus size={16} aria-hidden="true" /> Nova descoberta
          </button>
        )}
      </div>
      <Feedback error={q.error ?? del.error} />
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Título</th>
              <th>Categoria</th>
              <th>Status</th>
              <th>Evidências</th>
              <th>Publicado</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {q.data?.map((d) => (
              <tr key={d.id}>
                <td>{d.title}</td>
                <td>{DISCOVERY_KIND_LABELS[d.kind]}</td>
                <td>
                  <StatusBadge status={d.verificationStatus} />
                </td>
                <td className="num">{d.evidence.length}</td>
                <td>{d.published ? <Pill tone="ok">sim</Pill> : <Pill>não</Pill>}</td>
                <td>
                  <div className="actions">
                    {can('articles:write') && (
                      <button type="button" className="btn btn--ghost btn--sm" onClick={() => setEditing({ current: d, f: { ...d, changeNote: '' } })}>
                        Editar
                      </button>
                    )}
                    {can('articles:publish') && (
                      <ConfirmButton message={`Excluir “${d.title}”?`} onConfirm={() => del.mutate(d.id)}>
                        Excluir
                      </ConfirmButton>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {q.data?.length === 0 && (
              <tr>
                <td colSpan={6} className="muted">
                  Nenhuma descoberta registrada. O site mostra um aviso explicando que só publicamos achados com evidência.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {editing && <DiscoveryDialog initial={editing.f} current={editing.current} onClose={() => setEditing(null)} />}
    </>
  );
}
