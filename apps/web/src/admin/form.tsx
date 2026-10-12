import { useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { VERIFICATION_LABELS, VERIFICATION_STATUSES, type VerificationStatus } from '@pgi/shared';
import { errorText } from './api.ts';

export function Field({ label, htmlFor, hint, children, className }: { label: string; htmlFor: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <div className={`field ${className ?? ''}`}>
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {hint && <small>{hint}</small>}
    </div>
  );
}

export function StatusSelect({ id, value, onChange }: { id: string; value: VerificationStatus; onChange: (v: VerificationStatus) => void }) {
  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value as VerificationStatus)}>
      {VERIFICATION_STATUSES.map((s) => (
        <option key={s} value={s}>
          {VERIFICATION_LABELS[s]}
        </option>
      ))}
    </select>
  );
}

export function Feedback({ error, success }: { error?: unknown; success?: string | null }) {
  if (error) {
    return (
      <div className="alert alert--error" role="alert">
        {errorText(error)}
      </div>
    );
  }
  if (success) {
    return (
      <div className="alert alert--ok" role="status">
        {success}
      </div>
    );
  }
  return null;
}

/** Botão que pede confirmação antes de ações destrutivas. */
export function ConfirmButton({ onConfirm, children, message, className = 'btn btn--danger btn--sm', disabled }: { onConfirm: () => void; children: ReactNode; message: string; className?: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      className={className}
      disabled={disabled}
      onClick={() => {
        if (window.confirm(message)) onConfirm();
      }}
    >
      {children}
    </button>
  );
}

export function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title" onKeyDown={(e) => e.key === 'Escape' && onClose()}>
      <div className="dialog__panel">
        <div className="admin-head">
          <h2 id="dialog-title" style={{ margin: 0 }}>
            {title}
          </h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Fechar">
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Lista editável de itens simples (ex.: passos, palavras-chave). */
export function StringList({ id, label, values, onChange, placeholder }: { id: string; label: string; values: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const v = draft.trim();
    if (!v) return;
    onChange([...values, v]);
    setDraft('');
  };
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {values.length > 0 && (
        <ol style={{ margin: '0 0 6px', paddingLeft: 20 }}>
          {values.map((v, i) => (
            <li key={i} className="small">
              {v}{' '}
              <button type="button" className="btn btn--ghost btn--sm" style={{ padding: '1px 6px' }} onClick={() => onChange(values.filter((_, j) => j !== i))} aria-label={`Remover ${v}`}>
                ✕
              </button>
            </li>
          ))}
        </ol>
      )}
      <div className="row" style={{ flexWrap: 'nowrap' }}>
        <input
          id={id}
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
        />
        <button type="button" className="btn btn--ghost btn--sm" onClick={add}>
          Adicionar
        </button>
      </div>
    </div>
  );
}

/** Lista de links {url, label}. */
export function LinkList({ idPrefix, label, values, onChange }: { idPrefix: string; label: string; values: { url: string; label: string }[]; onChange: (v: { url: string; label: string }[]) => void }) {
  return (
    <div className="field">
      <span className="label">{label}</span>
      {values.map((v, i) => (
        <div key={i} className="row" style={{ flexWrap: 'nowrap' }}>
          <input aria-label="Rótulo" className="input" style={{ maxWidth: 200 }} value={v.label} onChange={(e) => onChange(values.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} placeholder="Rótulo" />
          <input aria-label="URL" className="input" value={v.url} onChange={(e) => onChange(values.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))} placeholder="https://" />
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => onChange(values.filter((_, j) => j !== i))} aria-label="Remover link">
            ✕
          </button>
        </div>
      ))}
      <button id={`${idPrefix}-add`} type="button" className="btn btn--ghost btn--sm" style={{ justifySelf: 'start' }} onClick={() => onChange([...values, { url: '', label: '' }])}>
        + Adicionar link
      </button>
    </div>
  );
}

export function Pill({ tone, children }: { tone?: 'ok' | 'err' | 'warn'; children: ReactNode }) {
  return <span className={`pill ${tone ? `pill--${tone}` : ''}`}>{children}</span>;
}
