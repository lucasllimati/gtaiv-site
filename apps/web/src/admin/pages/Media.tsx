import { useRef, useState, type FormEvent } from 'react';
import { Upload } from 'lucide-react';
import { formatDateTime } from '../../lib/format.ts';
import { useAuth } from '../AdminApp.tsx';
import { api, useApiMutation, useApiQuery } from '../api.ts';
import { ConfirmButton, Feedback, Field, Pill } from '../form.tsx';

export interface MediaItem {
  id: number;
  kind: string;
  title: string;
  url: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  width: number | null;
  height: number | null;
  alt: string | null;
  license: string;
  credit: string | null;
  articleId: number | null;
  createdAt: string;
}

export async function uploadMedia(file: Blob, meta: { title: string; alt?: string; license?: string; credit?: string; articleId?: number | null }, filename = 'arquivo'): Promise<MediaItem> {
  const fd = new FormData();
  // Os campos de texto vêm antes do arquivo para o servidor lê-los junto.
  fd.append('title', meta.title);
  if (meta.alt) fd.append('alt', meta.alt);
  fd.append('license', meta.license ?? 'original');
  if (meta.credit) fd.append('credit', meta.credit);
  if (meta.articleId) fd.append('articleId', String(meta.articleId));
  fd.append('file', file, filename);
  return api<MediaItem>('/media', { method: 'POST', body: fd });
}

const LICENSES: Record<string, string> = {
  original: 'Original (criado pelo portal)',
  'oficial-com-permissao': 'Material oficial com permissão de uso',
  'cc-by': 'Creative Commons BY (com atribuição)',
  cc0: 'Domínio público / CC0',
  licenciado: 'Licenciado (banco de imagens etc.)',
};

export function MediaAdmin() {
  const { can } = useAuth();
  const q = useApiQuery<MediaItem[]>(['media', 'all'], '/media');
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({ title: '', alt: '', license: 'original', credit: '' });
  const upload = useApiMutation(async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) throw new Error('Escolha um arquivo.');
    return uploadMedia(file, form, file.name);
  }, [['media']]);
  const del = useApiMutation((id: number) => api(`/media/${id}`, { method: 'DELETE' }), [['media']]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    upload.mutate(undefined, {
      onSuccess: () => {
        setForm({ title: '', alt: '', license: 'original', credit: '' });
        if (fileRef.current) fileRef.current.value = '';
      },
    });
  };

  return (
    <>
      <div className="admin-head">
        <div>
          <h1>Biblioteca de mídia</h1>
          <p>Imagens e vídeos do portal. Registre sempre a licença e o crédito. Não envie trailers, capturas ou reportagens de terceiros sem permissão.</p>
        </div>
      </div>
      {can('media:write') && (
        <form className="panel" onSubmit={submit} style={{ marginBottom: 20 }}>
          <Feedback error={upload.error ?? del.error} success={upload.isSuccess ? 'Arquivo enviado.' : null} />
          <div className="form-grid">
            <Field label="Arquivo (PNG, JPEG, WebP, GIF, WebM, MP4)" htmlFor="m-file">
              <input id="m-file" ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif,video/webm,video/mp4" required />
            </Field>
            <Field label="Título" htmlFor="m-title">
              <input id="m-title" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </Field>
            <Field label="Texto alternativo (acessibilidade)" htmlFor="m-alt">
              <input id="m-alt" value={form.alt} onChange={(e) => setForm({ ...form, alt: e.target.value })} />
            </Field>
            <Field label="Licença" htmlFor="m-license">
              <select id="m-license" value={form.license} onChange={(e) => setForm({ ...form, license: e.target.value })}>
                {Object.entries(LICENSES).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>
            {form.license !== 'original' && (
              <Field label="Crédito / atribuição" htmlFor="m-credit" className="span-2">
                <input id="m-credit" required value={form.credit} onChange={(e) => setForm({ ...form, credit: e.target.value })} />
              </Field>
            )}
          </div>
          <button type="submit" className="btn btn--primary" disabled={upload.isPending}>
            <Upload size={16} aria-hidden="true" /> {upload.isPending ? 'Enviando…' : 'Enviar'}
          </button>
        </form>
      )}
      <Feedback error={q.error} />
      <div className="studio-formats">
        {q.data
          ?.filter((m) => m.kind !== 'package')
          .map((m) => (
            <figure key={m.id} className="panel" style={{ margin: 0, padding: 12 }}>
              {m.url && m.mimeType?.startsWith('image/') && <img src={m.url} alt={m.alt ?? ''} style={{ borderRadius: 8, aspectRatio: '16/10', objectFit: 'cover', width: '100%' }} loading="lazy" />}
              {m.url && m.mimeType?.startsWith('video/') && <video src={m.url} controls style={{ borderRadius: 8, width: '100%' }} preload="metadata" />}
              <figcaption className="small" style={{ marginTop: 8 }}>
                <strong>{m.title}</strong>
                <div className="muted">
                  {m.width && m.height ? `${m.width}×${m.height} · ` : ''}
                  {m.sizeBytes ? `${Math.round(m.sizeBytes / 1024)} KB · ` : ''}
                  {formatDateTime(m.createdAt)}
                </div>
                <div className="row" style={{ marginTop: 6 }}>
                  <Pill tone={m.license === 'original' ? 'ok' : 'warn'}>{m.license}</Pill>
                  {m.url && (
                    <a className="small" href={m.url} target="_blank" rel="noopener noreferrer" download>
                      Baixar
                    </a>
                  )}
                  <span className="spacer" />
                  {can('media:write') && (
                    <ConfirmButton message={`Excluir “${m.title}”?`} onConfirm={() => del.mutate(m.id)}>
                      Excluir
                    </ConfirmButton>
                  )}
                </div>
                {m.credit && <div className="muted">Crédito: {m.credit}</div>}
              </figcaption>
            </figure>
          ))}
      </div>
      {q.data && q.data.filter((m) => m.kind !== 'package').length === 0 && <div className="state">Nenhum arquivo ainda.</div>}
    </>
  );
}
