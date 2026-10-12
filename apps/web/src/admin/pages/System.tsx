import { useEffect, useState } from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import { ROLE_LABELS, ROLES, VERIFICATION_LABELS, type Role, type VerificationStatus } from '@pgi/shared';
import { formatDateTime } from '../../lib/format.ts';
import { useAuth } from '../AdminApp.tsx';
import { api, useApiMutation, useApiQuery } from '../api.ts';
import { Dialog, Feedback, Field, Pill, StatusSelect } from '../form.tsx';

// ---------------- Métricas ----------------
interface Metrics {
  days: number;
  viewsByDay: { day: string; views: number }[];
  topPages: { path: string; views: number }[];
  clicksByTarget: { targetType: string; targetId: number; clicks: number; name: string }[];
  clicksByPlacement: { placement: string; clicks: number }[];
}

function Bars({ rows }: { rows: { label: string; value: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (rows.length === 0) return <p className="muted small">Sem dados no período.</p>;
  return (
    <div className="bars">
      {rows.map((r) => (
        <div key={r.label} className="bar">
          <span className="small" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.label}>
            {r.label}
          </span>
          <div className="bar__track" aria-hidden="true">
            <div className="bar__fill" style={{ width: `${(r.value / max) * 100}%` }} />
          </div>
          <span className="small" style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
            {r.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export function MetricsPage() {
  const [days, setDays] = useState(30);
  const q = useApiQuery<Metrics>(['metrics', days], `/metrics?days=${days}`);
  const d = q.data;
  return (
    <>
      <div className="admin-head">
        <div>
          <h1>Métricas</h1>
          <p>Visitas agregadas por página e cliques em afiliados e canais. Nenhum dado pessoal é coletado. Conversões dependem do relatório de cada programa de afiliados.</p>
        </div>
        <div className="row">
          {[7, 30, 90].map((n) => (
            <button key={n} type="button" className="chip" aria-pressed={days === n} onClick={() => setDays(n)}>
              {n} dias
            </button>
          ))}
        </div>
      </div>
      <Feedback error={q.error} />
      {d && (
        <div className="split">
          <section className="panel">
            <h2 style={{ fontSize: '1.05rem' }}>Visitas por dia</h2>
            <Bars rows={d.viewsByDay.map((r) => ({ label: r.day, value: r.views }))} />
          </section>
          <section className="panel">
            <h2 style={{ fontSize: '1.05rem' }}>Páginas mais vistas</h2>
            <Bars rows={d.topPages.map((r) => ({ label: r.path, value: r.views }))} />
          </section>
          <section className="panel">
            <h2 style={{ fontSize: '1.05rem' }}>Cliques por banner, produto ou canal</h2>
            <Bars rows={d.clicksByTarget.map((r) => ({ label: `${r.targetType}: ${r.name}`, value: r.clicks }))} />
          </section>
          <section className="panel">
            <h2 style={{ fontSize: '1.05rem' }}>Cliques por posição</h2>
            <Bars rows={d.clicksByPlacement.map((r) => ({ label: r.placement, value: r.clicks }))} />
          </section>
        </div>
      )}
    </>
  );
}

// ---------------- Auditoria ----------------
interface AuditRow {
  id: number;
  userEmail: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  details: Record<string, unknown> | null;
  createdAt: string;
}

export function AuditPage() {
  const [page, setPage] = useState(1);
  const q = useApiQuery<{ items: AuditRow[]; total: number; pageSize: number }>(['audit', page], `/audit?page=${page}&pageSize=50`);
  const pages = q.data ? Math.max(1, Math.ceil(q.data.total / q.data.pageSize)) : 1;
  return (
    <>
      <div className="admin-head">
        <div>
          <h1>Histórico de alterações</h1>
          <p>Registro das ações administrativas. Senhas e tokens nunca são gravados.</p>
        </div>
      </div>
      <Feedback error={q.error} />
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Quando</th>
              <th>Quem</th>
              <th>Ação</th>
              <th>Alvo</th>
              <th>Detalhes</th>
            </tr>
          </thead>
          <tbody>
            {q.data?.items.map((r) => (
              <tr key={r.id}>
                <td className="small">{formatDateTime(r.createdAt)}</td>
                <td className="small">{r.userEmail ?? 'sistema'}</td>
                <td>
                  <Pill>{r.action}</Pill>
                </td>
                <td className="small">
                  {r.entity}
                  {r.entityId ? ` #${r.entityId}` : ''}
                </td>
                <td className="small muted" style={{ maxWidth: 380, wordBreak: 'break-word' }}>
                  {r.details ? JSON.stringify(r.details) : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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

// ---------------- Usuários ----------------
interface UserRow {
  id: number;
  email: string;
  name: string;
  role: Role;
  active: boolean;
  lastLoginAt: string | null;
}

function UserDialog({ user, onClose }: { user?: UserRow; onClose: () => void }) {
  const [f, setF] = useState({ email: user?.email ?? '', name: user?.name ?? '', role: user?.role ?? ('editor' as Role), active: user?.active ?? true, password: '' });
  const save = useApiMutation(
    () =>
      user
        ? api(`/users/${user.id}`, { method: 'PUT', json: { name: f.name, role: f.role, active: f.active, ...(f.password ? { password: f.password } : {}) } })
        : api('/users', { method: 'POST', json: { email: f.email, name: f.name, role: f.role, password: f.password } }),
    [['users']],
  );
  return (
    <Dialog title={user ? 'Editar usuário' : 'Novo usuário'} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate(undefined, { onSuccess: onClose });
        }}
      >
        <Feedback error={save.error} />
        <div className="form-grid">
          <Field label="E-mail" htmlFor="u-email">
            <input id="u-email" type="email" required disabled={Boolean(user)} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
          </Field>
          <Field label="Nome" htmlFor="u-name">
            <input id="u-name" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          </Field>
          <Field label="Papel" htmlFor="u-role">
            <select id="u-role" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as Role })}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </Field>
          <Field label={user ? 'Nova senha (opcional)' : 'Senha'} htmlFor="u-pass" hint="Mínimo de 12 caracteres.">
            <input id="u-pass" type="password" autoComplete="new-password" minLength={12} required={!user} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
          </Field>
        </div>
        {user && (
          <label className="check" style={{ marginBottom: 14 }}>
            <input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} /> Ativo
          </label>
        )}
        <div>
          <button type="submit" className="btn btn--primary" disabled={save.isPending}>
            Salvar
          </button>
        </div>
      </form>
    </Dialog>
  );
}

export function UsersAdmin() {
  const q = useApiQuery<UserRow[]>(['users'], '/users');
  const [editing, setEditing] = useState<{ user?: UserRow } | null>(null);
  return (
    <>
      <div className="admin-head">
        <div>
          <h1>Usuários e permissões</h1>
          <p>Administrador: tudo. Editor: escreve, revisa e aprova, mas não publica. Leitor: apenas consulta. As permissões são validadas no servidor.</p>
        </div>
        <button type="button" className="btn btn--primary" onClick={() => setEditing({})}>
          <Plus size={16} aria-hidden="true" /> Novo usuário
        </button>
      </div>
      <Feedback error={q.error} />
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>E-mail</th>
              <th>Papel</th>
              <th>Status</th>
              <th>Último acesso</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {q.data?.map((u) => (
              <tr key={u.id}>
                <td>{u.name}</td>
                <td>{u.email}</td>
                <td>{ROLE_LABELS[u.role]}</td>
                <td>{u.active ? <Pill tone="ok">ativo</Pill> : <Pill tone="err">inativo</Pill>}</td>
                <td className="small">{u.lastLoginAt ? formatDateTime(u.lastLoginAt) : 'nunca'}</td>
                <td>
                  <div className="actions">
                    <button type="button" className="btn btn--ghost btn--sm" onClick={() => setEditing({ user: u })}>
                      Editar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editing && <UserDialog user={editing.user} onClose={() => setEditing(null)} />}
    </>
  );
}

// ---------------- Configurações ----------------
interface Fact {
  key: string;
  value: string;
  status: VerificationStatus;
  sourceUrl: string;
}
const FACT_LABELS: Record<string, string> = { releaseDate: 'Data de lançamento', platforms: 'Plataformas', developer: 'Desenvolvedora', setting: 'Localização' };

function FactRow({ fact, editable }: { fact: Fact; editable: boolean }) {
  const [f, setF] = useState(fact);
  useEffect(() => setF(fact), [fact]);
  const save = useApiMutation(() => api(`/facts/${fact.key}`, { method: 'PUT', json: { value: f.value, status: f.status, sourceUrl: f.sourceUrl } }), [['facts']]);
  return (
    <form
      className="repeat"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate(undefined);
      }}
    >
      <Feedback error={save.error} success={save.isSuccess ? 'Salvo.' : null} />
      <fieldset disabled={!editable} style={{ border: 0, padding: 0, margin: 0 }}>
        <div className="form-grid">
          <Field label={FACT_LABELS[fact.key] ?? fact.key} htmlFor={`f-${fact.key}`} hint={fact.key === 'releaseDate' ? 'Formato “19 de novembro de 2026” (usado na contagem regressiva).' : undefined}>
            <input id={`f-${fact.key}`} required value={f.value} onChange={(e) => setF({ ...f, value: e.target.value })} />
          </Field>
          <Field label="Status" htmlFor={`fs-${fact.key}`}>
            <StatusSelect id={`fs-${fact.key}`} value={f.status} onChange={(v) => setF({ ...f, status: v })} />
          </Field>
          <Field label="Fonte (URL)" htmlFor={`fu-${fact.key}`} className="span-2">
            <input id={`fu-${fact.key}`} type="url" required value={f.sourceUrl} onChange={(e) => setF({ ...f, sourceUrl: e.target.value })} />
          </Field>
        </div>
        <button type="submit" className="btn btn--ghost btn--sm" disabled={save.isPending}>
          Salvar fato
        </button>
      </fieldset>
    </form>
  );
}

export function SettingsAdmin() {
  const { can, me } = useAuth();
  const settings = useApiQuery<Record<string, unknown>>(['settings'], '/settings');
  const facts = useApiQuery<Fact[]>(['facts'], '/facts');
  const [form, setForm] = useState({ siteName: '', tagline: '', contactEmail: '' });
  useEffect(() => {
    const s = settings.data;
    if (s) setForm({ siteName: String(s.siteName ?? ''), tagline: String(s.tagline ?? ''), contactEmail: String(s.contactEmail ?? '') });
  }, [settings.data]);
  const save = useApiMutation(() => api('/settings', { method: 'PUT', json: form }), [['settings']]);
  const retention = useApiMutation(() => api<{ removedClicks: number }>('/maintenance/retention', { method: 'POST', json: {} }));
  const rebuild = useApiMutation(() => api('/publish/rebuild', { method: 'POST', json: {} }));
  const admin = can('users:manage');
  return (
    <>
      <div className="admin-head">
        <div>
          <h1>Configurações</h1>
          <p>Nome do portal, contato, fatos-chave da home e manutenção.</p>
        </div>
      </div>
      <div className="split">
        <section className="panel">
          <h2 style={{ fontSize: '1.05rem' }}>Identidade do portal</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate(undefined);
            }}
          >
            <Feedback error={save.error ?? settings.error} success={save.isSuccess ? 'Configurações salvas.' : null} />
            <fieldset disabled={!admin} style={{ border: 0, padding: 0, margin: 0 }}>
              <Field label="Nome do site" htmlFor="st-name" hint="Pode ser trocado a qualquer momento por uma marca original.">
                <input id="st-name" required maxLength={60} value={form.siteName} onChange={(e) => setForm({ ...form, siteName: e.target.value })} />
              </Field>
              <Field label="Slogan" htmlFor="st-tag">
                <input id="st-tag" maxLength={160} value={form.tagline} onChange={(e) => setForm({ ...form, tagline: e.target.value })} />
              </Field>
              <Field label="E-mail de contato público" htmlFor="st-mail">
                <input id="st-mail" type="email" value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} />
              </Field>
              <button type="submit" className="btn btn--primary" disabled={save.isPending}>
                Salvar
              </button>
            </fieldset>
          </form>
          <hr className="divider" />
          <h2 style={{ fontSize: '1.05rem' }}>Manutenção</h2>
          <Feedback error={retention.error ?? rebuild.error} success={retention.data ? `${retention.data.removedClicks} cliques antigos removidos.` : rebuild.isSuccess ? 'Republicação do site solicitada ao GitHub Actions.' : null} />
          <div className="row">
            {admin && (
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => retention.mutate(undefined)}>
                Aplicar política de retenção
              </button>
            )}
            {can('articles:publish') && (
              <button type="button" className="btn btn--ghost btn--sm" disabled={!me.features.rebuild} onClick={() => rebuild.mutate(undefined)} title={me.features.rebuild ? '' : 'Configure GITHUB_DISPATCH_TOKEN e GITHUB_REPOSITORY na API'}>
                <RefreshCw size={14} aria-hidden="true" /> Republicar site estático
              </button>
            )}
          </div>
          <p className="small muted" style={{ marginTop: 10 }}>
            IA: {me.features.ai ? 'ativa' : 'desativada (sem ANTHROPIC_API_KEY)'} · Mídia: {me.features.mediaDriver === 'r2' ? 'Cloudflare R2' : 'disco local'}
          </p>
        </section>
        <section className="panel">
          <h2 style={{ fontSize: '1.05rem' }}>Fatos-chave da home</h2>
          <p className="small muted">Exibidos na faixa de destaque e na contagem regressiva. Confira na fonte oficial antes de alterar.</p>
          <Feedback error={facts.error} />
          {facts.data?.map((f) => (
            <FactRow key={f.key} fact={f} editable={can('articles:publish')} />
          ))}
          <p className="small muted">Status disponíveis: {Object.values(VERIFICATION_LABELS).join(', ')}.</p>
        </section>
      </div>
    </>
  );
}
