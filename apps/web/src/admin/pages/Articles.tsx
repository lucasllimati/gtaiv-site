import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { Eye, Film, Pencil, Save, Send } from 'lucide-react';
import {
  APPROVAL_LABELS,
  APPROVAL_STATUSES,
  APPROVAL_TRANSITIONS,
  hasPermission,
  type ApprovalStatus,
  type VerificationStatus,
} from '@pgi/shared';
import { StatusBadge } from '../../components/ui.tsx';
import { formatDateTime } from '../../lib/format.ts';
import { renderMarkdown } from '../../lib/markdown.ts';
import { useAuth } from '../AdminApp.tsx';
import { api, useApiMutation, useApiQuery } from '../api.ts';
import { ConfirmButton, Feedback, Field, Pill, StatusSelect } from '../form.tsx';

interface ListItem {
  id: number;
  slug: string;
  title: string;
  approvalStatus: ApprovalStatus;
  verificationStatus: VerificationStatus;
  category: string;
  featured: boolean;
  aiAssisted: boolean;
  updatedAt: string;
  publishedAt: string | null;
}

const approvalTone = (s: ApprovalStatus) => (s === 'published' ? 'ok' : s === 'rejected' ? 'err' : s === 'in_review' || s === 'approved' ? 'warn' : undefined);

export function ArticleList() {
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? '';
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const query = useApiQuery<{ items: ListItem[]; total: number; pageSize: number }>(
    ['articles', status, q, page],
    `/articles?page=${page}&pageSize=25${status ? `&status=${status}` : ''}${q ? `&q=${encodeURIComponent(q)}` : ''}`,
  );
  const pages = query.data ? Math.max(1, Math.ceil(query.data.total / query.data.pageSize)) : 1;
  return (
    <>
      <div className="admin-head">
        <div>
          <h1>Artigos</h1>
          <p>Rascunhos, revisão, aprovação e publicação.</p>
        </div>
        <Link className="btn btn--primary" to="novo">
          Novo artigo
        </Link>
      </div>
      <div className="filters">
        <input className="input" style={{ maxWidth: 280 }} placeholder="Buscar por título…" aria-label="Buscar por título" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        <button type="button" className="chip" aria-pressed={!status} onClick={() => setParams({})}>
          Todos
        </button>
        {APPROVAL_STATUSES.map((s) => (
          <button key={s} type="button" className="chip" aria-pressed={status === s} onClick={() => { setParams({ status: s }); setPage(1); }}>
            {APPROVAL_LABELS[s]}
          </button>
        ))}
      </div>
      <Feedback error={query.error} />
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Título</th>
              <th>Categoria</th>
              <th>Verificação</th>
              <th>Aprovação</th>
              <th>Atualizado</th>
            </tr>
          </thead>
          <tbody>
            {query.data?.items.map((a) => (
              <tr key={a.id}>
                <td>
                  <Link to={String(a.id)}>{a.title}</Link>
                  {a.featured && <> <Pill tone="ok">manchete</Pill></>}
                  {a.aiAssisted && <> <Pill>IA</Pill></>}
                </td>
                <td>{a.category}</td>
                <td>
                  <StatusBadge status={a.verificationStatus} />
                </td>
                <td>
                  <Pill tone={approvalTone(a.approvalStatus)}>{APPROVAL_LABELS[a.approvalStatus]}</Pill>
                </td>
                <td className="small muted">{formatDateTime(a.updatedAt)}</td>
              </tr>
            ))}
            {query.data?.items.length === 0 && (
              <tr>
                <td colSpan={5} className="muted">
                  Nenhum artigo encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="pagination">
          <button type="button" className="btn btn--ghost btn--sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Anterior</button>
          <span>{page}/{pages}</span>
          <button type="button" className="btn btn--ghost btn--sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>Próxima</button>
        </div>
      )}
    </>
  );
}

interface SourceRow { url: string; title: string; publisher: string; publishedAt: string | null; isPrimary: boolean }
interface ClaimRow { text: string; status: VerificationStatus; sourceUrl: string | null; notes?: string | null }
interface Detail {
  id: number;
  slug: string;
  title: string;
  summary: string;
  body: string;
  category: { slug: string; name: string };
  verificationStatus: VerificationStatus;
  approvalStatus: ApprovalStatus;
  authorName: string;
  coverAssetId: number | null;
  coverAlt: string | null;
  featured: boolean;
  tags: string[];
  aiAssisted: boolean;
  reviewNote: string | null;
  approvedAt: string | null;
  approvedByName: string | null;
  publishedAt: string | null;
  updatedAt: string;
  sources: SourceRow[];
  claims: ClaimRow[];
  sourceItem: { item: { title: string; excerpt: string | null; url: string; publishedAt: string | null }; sourceName: string; sourceType: string } | null;
}

interface FormState {
  title: string;
  slug: string;
  summary: string;
  body: string;
  categorySlug: string;
  verificationStatus: VerificationStatus;
  authorName: string;
  coverAssetId: number | null;
  coverAlt: string;
  featured: boolean;
  tags: string;
  sources: SourceRow[];
  claims: ClaimRow[];
}

const emptyForm = (author: string): FormState => ({
  title: '',
  slug: '',
  summary: '',
  body: '',
  categorySlug: 'noticias',
  verificationStatus: 'in_review',
  authorName: author,
  coverAssetId: null,
  coverAlt: '',
  featured: false,
  tags: '',
  sources: [],
  claims: [],
});

const TRANSITION_LABEL: Partial<Record<ApprovalStatus, string>> = {
  in_review: 'Enviar para revisão',
  approved: 'Aprovar',
  rejected: 'Rejeitar',
  published: 'Publicar',
  archived: 'Arquivar',
  draft: 'Voltar para rascunho',
};

export function ArticleEditor() {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();
  const { me, can } = useAuth();
  const detail = useApiQuery<Detail>(['article', id], `/articles/${id}`, !isNew);
  const cats = useApiQuery<{ slug: string; name: string }[]>(['categories'], '/categories');
  const media = useApiQuery<{ id: number; title: string; url: string | null; kind: string }[]>(['media', 'image'], '/media?kind=image');
  const [form, setForm] = useState<FormState>(() => emptyForm(me.user.name));
  const [preview, setPreview] = useState(false);
  const [note, setNote] = useState('');
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    const d = detail.data;
    if (!d) return;
    setForm({
      title: d.title,
      slug: d.slug,
      summary: d.summary,
      body: d.body,
      categorySlug: d.category.slug,
      verificationStatus: d.verificationStatus,
      authorName: d.authorName,
      coverAssetId: d.coverAssetId,
      coverAlt: d.coverAlt ?? '',
      featured: d.featured,
      tags: d.tags.join(', '),
      sources: d.sources.map((s) => ({ url: s.url, title: s.title, publisher: s.publisher, publishedAt: s.publishedAt, isPrimary: s.isPrimary })),
      claims: d.claims.map((c) => ({ text: c.text, status: c.status, sourceUrl: c.sourceUrl, notes: c.notes ?? null })),
    });
  }, [detail.data]);

  const payload = () => ({
    title: form.title,
    slug: form.slug || undefined,
    summary: form.summary,
    body: form.body,
    categorySlug: form.categorySlug,
    verificationStatus: form.verificationStatus,
    authorName: form.authorName,
    coverAssetId: form.coverAssetId,
    coverAlt: form.coverAlt || null,
    featured: form.featured,
    tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
    sources: form.sources.map((s) => ({ ...s, publishedAt: s.publishedAt || null })),
    claims: form.claims.map((c) => ({ ...c, sourceUrl: c.sourceUrl || null })),
  });

  const save = useApiMutation(
    () => (isNew ? api<Detail>('/articles', { method: 'POST', json: payload() }) : api<Detail>(`/articles/${id}`, { method: 'PUT', json: payload() })),
    [['articles'], ['article', id], ['dashboard']],
  );
  const transition = useApiMutation((to: ApprovalStatus) => api<Detail>(`/articles/${id}/transition`, { method: 'POST', json: { to, note: note || undefined } }), [['articles'], ['article', id], ['dashboard']]);
  const remove = useApiMutation(() => api(`/articles/${id}`, { method: 'DELETE' }), [['articles'], ['dashboard']]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setSaved(null);
    save.mutate(undefined, {
      onSuccess: (d) => {
        setSaved('Alterações salvas.');
        if (isNew) navigate(`../artigos/${d.id}`, { replace: true });
      },
    });
  };

  const html = useMemo(() => (preview ? renderMarkdown(form.body) : ''), [preview, form.body]);
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));
  const d = detail.data;
  const role = me.user.role;
  const transitions = d
    ? APPROVAL_TRANSITIONS[d.approvalStatus].filter((to) => {
        if (to === 'approved' || to === 'rejected') return hasPermission(role, 'articles:approve');
        if (to === 'published' || d.approvalStatus === 'published') return hasPermission(role, 'articles:publish');
        return can('articles:write');
      })
    : [];
  const readOnly = !can('articles:write') || (d && ['approved', 'published'].includes(d.approvalStatus) && !can('articles:publish'));

  if (!isNew && detail.isLoading) return <p role="status">Carregando…</p>;
  if (!isNew && detail.error) return <Feedback error={detail.error} />;

  return (
    <>
      <div className="admin-head">
        <div>
          <h1>{isNew ? 'Novo artigo' : 'Editar artigo'}</h1>
          {d && (
            <p className="row">
              <Pill tone={approvalTone(d.approvalStatus)}>{APPROVAL_LABELS[d.approvalStatus]}</Pill>
              {d.approvedAt && <span className="small">Aprovado por {d.approvedByName ?? '—'} em {formatDateTime(d.approvedAt)}</span>}
              {d.approvalStatus === 'published' && (
                <a className="small" href={`${import.meta.env.BASE_URL}noticias/${d.slug}`} target="_blank" rel="noopener noreferrer">
                  Ver no site
                </a>
              )}
            </p>
          )}
        </div>
        {d && (d.approvalStatus === 'approved' || d.approvalStatus === 'published') && (
          <Link className="btn btn--ghost" to={`../estudio/${d.id}`}>
            <Film size={16} aria-hidden="true" /> Estúdio social
          </Link>
        )}
      </div>

      {d?.reviewNote && (
        <div className="alert alert--info" role="note">
          <strong>Nota de revisão:</strong> {d.reviewNote}
        </div>
      )}
      <Feedback error={save.error ?? transition.error ?? remove.error} success={saved} />

      <div className={d?.sourceItem ? 'split' : undefined}>
        <form onSubmit={submit} className="panel" aria-label="Formulário do artigo">
          <fieldset disabled={Boolean(readOnly)} style={{ border: 0, padding: 0, margin: 0 }}>
            <Field label="Título" htmlFor="a-title">
              <input id="a-title" required minLength={8} maxLength={160} value={form.title} onChange={(e) => set('title', e.target.value)} />
            </Field>
            <div className="form-grid">
              <Field label="Slug (URL)" htmlFor="a-slug" hint="Deixe vazio para gerar a partir do título.">
                <input id="a-slug" value={form.slug} onChange={(e) => set('slug', e.target.value.toLowerCase())} pattern="[a-z0-9]+(-[a-z0-9]+)*" />
              </Field>
              <Field label="Categoria" htmlFor="a-cat">
                <select id="a-cat" value={form.categorySlug} onChange={(e) => set('categorySlug', e.target.value)}>
                  {cats.data?.map((c) => (
                    <option key={c.slug} value={c.slug}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Status de verificação" htmlFor="a-ver" hint="Use “Confirmado” só com fonte oficial ou evidência primária.">
                <StatusSelect id="a-ver" value={form.verificationStatus} onChange={(v) => set('verificationStatus', v)} />
              </Field>
              <Field label="Autor editorial" htmlFor="a-author">
                <input id="a-author" required value={form.authorName} onChange={(e) => set('authorName', e.target.value)} />
              </Field>
            </div>
            <Field label="Resumo" htmlFor="a-summary" hint={`${form.summary.length}/400 caracteres`}>
              <textarea id="a-summary" required minLength={20} maxLength={400} value={form.summary} onChange={(e) => set('summary', e.target.value)} style={{ minHeight: 80 }} />
            </Field>
            <div className="field">
              <div className="row">
                <label htmlFor="a-body" style={{ flex: 1 }}>
                  Corpo (Markdown: ## títulos, **negrito**, listas, [links](https://…))
                </label>
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => setPreview((p) => !p)}>
                  {preview ? <Pencil size={14} aria-hidden="true" /> : <Eye size={14} aria-hidden="true" />} {preview ? 'Editar' : 'Prévia'}
                </button>
              </div>
              {preview ? (
                <div className="prose repeat" dangerouslySetInnerHTML={{ __html: html }} />
              ) : (
                <textarea id="a-body" className="tall" required minLength={40} value={form.body} onChange={(e) => set('body', e.target.value)} />
              )}
            </div>
            <div className="form-grid">
              <Field label="Tags (separadas por vírgula)" htmlFor="a-tags">
                <input id="a-tags" value={form.tags} onChange={(e) => set('tags', e.target.value)} />
              </Field>
              <Field label="Capa (biblioteca de mídia)" htmlFor="a-cover" hint="Sem capa, o site usa uma ilustração original.">
                <select id="a-cover" value={form.coverAssetId ?? ''} onChange={(e) => set('coverAssetId', e.target.value ? Number(e.target.value) : null)}>
                  <option value="">Ilustração automática</option>
                  {media.data?.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.title}
                    </option>
                  ))}
                </select>
              </Field>
              {form.coverAssetId && (
                <Field label="Texto alternativo da capa" htmlFor="a-alt" className="span-2">
                  <input id="a-alt" value={form.coverAlt} onChange={(e) => set('coverAlt', e.target.value)} maxLength={300} />
                </Field>
              )}
            </div>
            <label className="check" style={{ marginBottom: 16 }}>
              <input type="checkbox" checked={form.featured} onChange={(e) => set('featured', e.target.checked)} /> Manchete da home
            </label>

            <h2 style={{ fontSize: '1.05rem', marginTop: 10 }}>Fontes</h2>
            {form.sources.map((s, i) => (
              <div key={i} className="repeat">
                <div className="form-grid">
                  <Field label="URL" htmlFor={`s-url-${i}`} className="span-2">
                    <input id={`s-url-${i}`} type="url" required value={s.url} onChange={(e) => set('sources', form.sources.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))} />
                  </Field>
                  <Field label="Título" htmlFor={`s-title-${i}`}>
                    <input id={`s-title-${i}`} required value={s.title} onChange={(e) => set('sources', form.sources.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
                  </Field>
                  <Field label="Veículo" htmlFor={`s-pub-${i}`}>
                    <input id={`s-pub-${i}`} required value={s.publisher} onChange={(e) => set('sources', form.sources.map((x, j) => (j === i ? { ...x, publisher: e.target.value } : x)))} />
                  </Field>
                </div>
                <div className="row">
                  <label className="check">
                    <input type="checkbox" checked={s.isPrimary} onChange={(e) => set('sources', form.sources.map((x, j) => ({ ...x, isPrimary: j === i ? e.target.checked : e.target.checked ? false : x.isPrimary })))} /> Fonte principal
                  </label>
                  <span className="spacer" />
                  <button type="button" className="btn btn--danger btn--sm" onClick={() => set('sources', form.sources.filter((_, j) => j !== i))}>
                    Remover fonte
                  </button>
                </div>
              </div>
            ))}
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => set('sources', [...form.sources, { url: '', title: '', publisher: '', publishedAt: null, isPrimary: form.sources.length === 0 }])}>
              + Adicionar fonte
            </button>

            <h2 style={{ fontSize: '1.05rem', marginTop: 22 }}>Afirmações e evidências</h2>
            <p className="small muted">Liste as afirmações relevantes do texto, o status de cada uma e a fonte que a sustenta. Elas aparecem na tabela “O que é fato e o que não é” do artigo.</p>
            {form.claims.map((c, i) => (
              <div key={i} className="repeat">
                <Field label="Afirmação" htmlFor={`c-text-${i}`}>
                  <input id={`c-text-${i}`} required value={c.text} onChange={(e) => set('claims', form.claims.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} />
                </Field>
                <div className="form-grid">
                  <Field label="Status" htmlFor={`c-st-${i}`}>
                    <StatusSelect id={`c-st-${i}`} value={c.status} onChange={(v) => set('claims', form.claims.map((x, j) => (j === i ? { ...x, status: v } : x)))} />
                  </Field>
                  <Field label="URL da evidência" htmlFor={`c-url-${i}`}>
                    <input id={`c-url-${i}`} type="url" value={c.sourceUrl ?? ''} onChange={(e) => set('claims', form.claims.map((x, j) => (j === i ? { ...x, sourceUrl: e.target.value } : x)))} />
                  </Field>
                </div>
                <button type="button" className="btn btn--danger btn--sm" onClick={() => set('claims', form.claims.filter((_, j) => j !== i))}>
                  Remover
                </button>
              </div>
            ))}
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => set('claims', [...form.claims, { text: '', status: 'reported', sourceUrl: '' }])}>
              + Adicionar afirmação
            </button>

            <hr className="divider" />
            <div className="row">
              <button type="submit" className="btn btn--primary" disabled={save.isPending}>
                <Save size={16} aria-hidden="true" /> {save.isPending ? 'Salvando…' : 'Salvar'}
              </button>
              {d && ['approved'].includes(d.approvalStatus) && <span className="small muted">Editar um artigo aprovado o devolve para revisão.</span>}
            </div>
          </fieldset>
        </form>

        {d?.sourceItem && (
          <aside className="panel editor-side diff-col" aria-label="Fonte original">
            <div className="eyebrow">Fonte original — comparação</div>
            <h2 style={{ fontSize: '1.05rem', marginTop: 6 }}>{d.sourceItem.item.title}</h2>
            <p className="small muted">
              {d.sourceItem.sourceName} · {d.sourceItem.item.publishedAt ? formatDateTime(d.sourceItem.item.publishedAt) : 'sem data'}
            </p>
            <div className="copy-box">{d.sourceItem.item.excerpt ?? 'O feed não forneceu resumo.'}</div>
            <p className="small" style={{ marginTop: 10 }}>
              <a href={d.sourceItem.item.url} target="_blank" rel="noopener noreferrer">
                Ler a publicação original
              </a>
            </p>
            <div className="alert alert--warn small">
              Confira cada afirmação na fonte. O texto final precisa ser original: não copie frases e não apenas troque palavras por sinônimos.
            </div>
          </aside>
        )}
      </div>

      {d && (
        <section className="panel" style={{ marginTop: 16 }} aria-label="Fluxo de aprovação">
          <h2 style={{ fontSize: '1.05rem' }}>Fluxo editorial</h2>
          <p className="small muted">
            Rascunho → Revisão → Aprovação humana → Publicação. Somente administradores publicam. Quem aprova e quando fica registrado.
          </p>
          <Field label="Nota (opcional)" htmlFor="t-note">
            <input id="t-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} placeholder="Motivo da rejeição, ajustes pedidos…" />
          </Field>
          <div className="row">
            {transitions.map((to) => (
              <button
                key={to}
                type="button"
                className={to === 'published' ? 'btn btn--primary' : to === 'rejected' || to === 'archived' ? 'btn btn--danger' : 'btn btn--ghost'}
                disabled={transition.isPending}
                onClick={() => transition.mutate(to, { onSuccess: () => setNote('') })}
              >
                {to === 'published' && <Send size={15} aria-hidden="true" />} {TRANSITION_LABEL[to] ?? to}
              </button>
            ))}
            <span className="spacer" />
            {can('articles:publish') && d.approvalStatus !== 'published' && (
              <ConfirmButton message="Excluir este artigo definitivamente?" onConfirm={() => remove.mutate(undefined, { onSuccess: () => navigate('../artigos') })}>
                Excluir
              </ConfirmButton>
            )}
          </div>
        </section>
      )}
    </>
  );
}
