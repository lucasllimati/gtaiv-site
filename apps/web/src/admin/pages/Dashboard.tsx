import { Link } from 'react-router';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { APPROVAL_LABELS, type ApprovalStatus } from '@pgi/shared';
import { formatDateTime } from '../../lib/format.ts';
import { useAuth } from '../AdminApp.tsx';
import { useApiQuery } from '../api.ts';
import { Feedback, Pill } from '../form.tsx';

interface DashboardData {
  articles: Partial<Record<ApprovalStatus, number>>;
  queue: number;
  failingSources: { id: number; name: string; lastError: string | null; consecutiveFailures: number; lastRunAt: string | null }[];
  lastRuns: { id: number; kind: string; status: string; trigger: string; startedAt: string; finishedAt: string | null; stats: Record<string, number> }[];
  views7: number;
  clicks7: number;
  ai: { enabled: boolean; usedToday: number; dailyLimit: number };
  alerts: string[];
}

export const runTone = (s: string) => (s === 'success' ? 'ok' : s === 'failed' ? 'err' : s === 'partial' || s === 'running' ? 'warn' : undefined);

export function Dashboard() {
  const { me } = useAuth();
  const q = useApiQuery<DashboardData>(['dashboard'], '/dashboard');
  const d = q.data;
  return (
    <>
      <div className="admin-head">
        <div>
          <h1>Olá, {me.user.name.split(' ')[0]}</h1>
          <p>Resumo da operação editorial e das automações.</p>
        </div>
        <Link className="btn btn--primary" to="artigos/novo">
          Novo artigo
        </Link>
      </div>
      <Feedback error={q.error} />
      {d && (
        <>
          <div className="kpis">
            <Link to="fila" className="kpi" style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="kpi__label">Itens na fila</div>
              <div className="kpi__value">{d.queue}</div>
            </Link>
            {(['draft', 'in_review', 'approved', 'published'] as const).map((s) => (
              <Link key={s} to={`artigos?status=${s}`} className="kpi" style={{ textDecoration: 'none', color: 'inherit' }}>
                <div className="kpi__label">{APPROVAL_LABELS[s]}</div>
                <div className="kpi__value">{d.articles[s] ?? 0}</div>
              </Link>
            ))}
            <div className="kpi">
              <div className="kpi__label">Visitas (7 dias)</div>
              <div className="kpi__value">{d.views7}</div>
            </div>
            <div className="kpi">
              <div className="kpi__label">Cliques afiliados/canais (7 dias)</div>
              <div className="kpi__value">{d.clicks7}</div>
            </div>
            <div className="kpi">
              <div className="kpi__label">Chamadas de IA hoje</div>
              <div className="kpi__value">{d.ai.enabled ? `${d.ai.usedToday}/${d.ai.dailyLimit}` : '—'}</div>
              {!d.ai.enabled && <div className="small muted">IA desativada: os rascunhos são gerados por modelo de texto</div>}
            </div>
          </div>

          <div className="split">
            <section className="panel">
              <h2 style={{ fontSize: '1.1rem' }}>Alertas</h2>
              {d.alerts.length === 0 ? (
                <p className="row muted">
                  <CheckCircle2 size={18} color="var(--st-confirmed)" aria-hidden="true" /> Nenhum alerta.
                </p>
              ) : (
                <ul className="list-plain stack">
                  {d.alerts.map((a, i) => (
                    <li key={i} className="row" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}>
                      <AlertTriangle size={17} color="var(--st-in_review)" aria-hidden="true" style={{ flexShrink: 0, marginTop: 3 }} />
                      <span>{a}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section className="panel">
              <div className="admin-head" style={{ marginBottom: 8 }}>
                <h2 style={{ fontSize: '1.1rem', margin: 0 }}>Últimas coletas</h2>
                <Link to="pipeline" className="link-arrow">
                  Ver todas
                </Link>
              </div>
              {d.lastRuns.length === 0 ? (
                <p className="muted">Nenhuma execução ainda. Rode a coleta em “Fontes”.</p>
              ) : (
                <ul className="list-plain list-links">
                  {d.lastRuns.map((r) => (
                    <li key={r.id}>
                      <Link to={`pipeline?run=${r.id}`}>
                        <span>
                          #{r.id} · {formatDateTime(r.startedAt)} · {r.stats.inserted ?? 0} novos
                        </span>
                        <Pill tone={runTone(r.status)}>{r.status}</Pill>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      )}
    </>
  );
}
