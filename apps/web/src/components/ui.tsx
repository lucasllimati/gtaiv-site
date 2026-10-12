import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { AlertTriangle, ChevronLeft, ChevronRight, Inbox, RefreshCw } from 'lucide-react';
import {
  VERIFICATION_DESCRIPTIONS,
  VERIFICATION_LABELS,
  type VerificationStatus,
} from '@pgi/shared';

export function StatusBadge({ status, withTitle = true }: { status: VerificationStatus; withTitle?: boolean }) {
  return (
    <span className={`badge badge--${status}`} title={withTitle ? VERIFICATION_DESCRIPTIONS[status] : undefined}>
      <span className="badge__dot" aria-hidden="true" />
      {VERIFICATION_LABELS[status]}
    </span>
  );
}

export function StatusExplainer({ status }: { status: VerificationStatus }) {
  const strong: Record<VerificationStatus, string> = {
    confirmed: 'Informação confirmada.',
    reported: 'Informação reportada por fonte identificada.',
    rumor: 'Rumor — não confirmado.',
    theory: 'Teoria / especulação.',
    debunked: 'Informação desmentida.',
    outdated: 'Conteúdo desatualizado.',
    in_review: 'Em revisão pela redação.',
  };
  return (
    <div className={`status-box badge--${status}`} role="note" style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>
      <AlertTriangle size={20} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
      <p>
        <strong>{strong[status]}</strong> {VERIFICATION_DESCRIPTIONS[status]}{' '}
        <Link to="/sobre#verificacao">Entenda nossos critérios.</Link>
      </p>
    </div>
  );
}

export function Loading({ label = 'Carregando…', cards = 3 }: { label?: string; cards?: number }) {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      <div className="grid grid--3">
        {Array.from({ length: cards }, (_, i) => (
          <div key={i} className="skeleton" />
        ))}
      </div>
    </div>
  );
}

export function ErrorState({ title = 'Não foi possível carregar', message, onRetry }: { title?: string; message?: string; onRetry?: () => void }) {
  return (
    <div className="state state--error" role="alert">
      <AlertTriangle size={32} aria-hidden="true" />
      <h3>{title}</h3>
      <p>{message ?? 'Verifique sua conexão e tente novamente. Se o problema continuar, o conteúdo pode estar temporariamente indisponível.'}</p>
      {onRetry && (
        <button type="button" className="btn btn--ghost btn--sm" onClick={onRetry}>
          <RefreshCw size={16} aria-hidden="true" /> Tentar novamente
        </button>
      )}
    </div>
  );
}

export function Empty({ title, children, icon }: { title: string; children?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="state">
      {icon ?? <Inbox size={32} aria-hidden="true" />}
      <h3>{title}</h3>
      {children && <div className="muted">{children}</div>}
    </div>
  );
}

export function SectionHead({ title, icon, description, action }: { title: string; icon?: ReactNode; description?: string; action?: ReactNode }) {
  return (
    <div className="section-head">
      <div>
        <h2>
          {icon}
          {title}
        </h2>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function Pagination({ page, pages, onPage }: { page: number; pages: number; onPage: (p: number) => void }) {
  if (pages <= 1) return null;
  return (
    <nav className="pagination" aria-label="Paginação">
      <button type="button" className="btn btn--ghost btn--sm" onClick={() => onPage(page - 1)} disabled={page <= 1}>
        <ChevronLeft size={16} aria-hidden="true" /> Anterior
      </button>
      <span aria-live="polite">
        Página {page} de {pages}
      </span>
      <button type="button" className="btn btn--ghost btn--sm" onClick={() => onPage(page + 1)} disabled={page >= pages}>
        Próxima <ChevronRight size={16} aria-hidden="true" />
      </button>
    </nav>
  );
}

export function ExternalLink({ href, children, className, sponsored }: { href: string; children: ReactNode; className?: string; sponsored?: boolean }) {
  return (
    <a href={href} className={className} target="_blank" rel={sponsored ? 'sponsored noopener noreferrer' : 'noopener noreferrer'}>
      {children}
    </a>
  );
}
