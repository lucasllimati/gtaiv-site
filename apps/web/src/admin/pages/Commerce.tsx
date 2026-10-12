import { useState } from 'react';
import { Copy, Plus } from 'lucide-react';
import {
  AVAILABILITY,
  AVAILABILITY_LABELS,
  BANNER_SLOT_LABELS,
  BANNER_SLOTS,
  PRODUCT_CATEGORIES,
  PRODUCT_CATEGORY_LABELS,
  PRICE_MAX_AGE_HOURS,
  type Availability,
  type BannerSlot,
  type BannerStatus,
  type ChannelKind,
  type ProductCategory,
} from '@pgi/shared';
import { formatDateTime, formatMoney } from '../../lib/format.ts';
import { useAuth } from '../AdminApp.tsx';
import { api, fromLocalInput, toLocalInput, useApiMutation, useApiQuery } from '../api.ts';
import { ConfirmButton, Dialog, Feedback, Field, Pill } from '../form.tsx';

// ---------------- Produtos ----------------
interface Product {
  id: number;
  name: string;
  category: ProductCategory;
  description: string | null;
  imageUrl: string | null;
  priceCents: number | null;
  currency: string;
  priceCheckedAt: string | null;
  availability: Availability;
  active: boolean;
  sortOrder: number;
  affiliateUrl: string | null;
  affiliateProgram: string | null;
  store: string | null;
  priceFresh: boolean;
}
interface ProductForm {
  name: string;
  category: ProductCategory;
  description: string;
  imageUrl: string;
  store: string;
  affiliateUrl: string;
  affiliateProgram: string;
  price: string;
  priceCheckedAt: string | null;
  availability: Availability;
  active: boolean;
  sortOrder: number;
}

function parsePrice(v: string): number | null {
  const clean = v.replace(/[^\d,.]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
  if (!clean) return null;
  const n = Math.round(Number(clean) * 100);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function ProductDialog({ initial, id, onClose }: { initial: ProductForm; id?: number; onClose: () => void }) {
  const [f, setF] = useState(initial);
  const save = useApiMutation(() => {
    const priceCents = parsePrice(f.price);
    return api(id ? `/products/${id}` : '/products', {
      method: id ? 'PUT' : 'POST',
      json: {
        name: f.name,
        category: f.category,
        description: f.description || null,
        imageUrl: f.imageUrl || null,
        store: f.store,
        affiliateUrl: f.affiliateUrl,
        affiliateProgram: f.affiliateProgram || null,
        priceCents,
        priceCheckedAt: priceCents ? f.priceCheckedAt : null,
        currency: 'BRL',
        availability: f.availability,
        active: f.active,
        sortOrder: f.sortOrder,
      },
    });
  }, [['products']]);
  return (
    <Dialog title={id ? 'Editar produto' : 'Novo produto'} onClose={onClose}>
      <div className="alert alert--info small">
        Use somente links gerados na sua conta de afiliado. O preço só aparece no site se for informado com a data/hora da verificação na loja, e some
        automaticamente após {PRICE_MAX_AGE_HOURS} horas.
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate(undefined, { onSuccess: onClose });
        }}
      >
        <Feedback error={save.error} />
        <div className="form-grid">
          <Field label="Nome do produto" htmlFor="p-name" className="span-2">
            <input id="p-name" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          </Field>
          <Field label="Categoria" htmlFor="p-cat">
            <select id="p-cat" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value as ProductCategory })}>
              {PRODUCT_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {PRODUCT_CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Loja" htmlFor="p-store">
            <input id="p-store" required value={f.store} onChange={(e) => setF({ ...f, store: e.target.value })} placeholder="Amazon" />
          </Field>
          <Field label="Link afiliado" htmlFor="p-url" className="span-2">
            <input id="p-url" type="url" required value={f.affiliateUrl} onChange={(e) => setF({ ...f, affiliateUrl: e.target.value })} />
          </Field>
          <Field label="Programa de afiliados" htmlFor="p-prog">
            <input id="p-prog" value={f.affiliateProgram} onChange={(e) => setF({ ...f, affiliateProgram: e.target.value })} placeholder="Amazon Associados" />
          </Field>
          <Field label="Disponibilidade" htmlFor="p-av">
            <select id="p-av" value={f.availability} onChange={(e) => setF({ ...f, availability: e.target.value as Availability })}>
              {AVAILABILITY.map((a) => (
                <option key={a} value={a}>
                  {AVAILABILITY_LABELS[a]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Preço verificado (R$)" htmlFor="p-price" hint="Deixe vazio se não conferiu agora.">
            <input id="p-price" inputMode="decimal" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} placeholder="3.499,00" />
          </Field>
          <Field label="Verificado em" htmlFor="p-checked">
            <div className="row" style={{ flexWrap: 'nowrap' }}>
              <input id="p-checked" type="datetime-local" value={toLocalInput(f.priceCheckedAt)} onChange={(e) => setF({ ...f, priceCheckedAt: fromLocalInput(e.target.value) })} />
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setF({ ...f, priceCheckedAt: new Date().toISOString() })}>
                Agora
              </button>
            </div>
          </Field>
          <Field label="Imagem (URL permitida pela loja)" htmlFor="p-img" className="span-2">
            <input id="p-img" type="url" value={f.imageUrl} onChange={(e) => setF({ ...f, imageUrl: e.target.value })} />
          </Field>
          <Field label="Descrição" htmlFor="p-desc" className="span-2">
            <textarea id="p-desc" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} style={{ minHeight: 70 }} />
          </Field>
          <Field label="Ordem" htmlFor="p-order">
            <input id="p-order" type="number" min={0} value={f.sortOrder} onChange={(e) => setF({ ...f, sortOrder: Number(e.target.value) })} />
          </Field>
          <div className="field">
            <span className="label">Exibição</span>
            <label className="check">
              <input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} /> Ativo na vitrine
            </label>
          </div>
        </div>
        <button type="submit" className="btn btn--primary" disabled={save.isPending}>
          Salvar
        </button>
      </form>
    </Dialog>
  );
}

export function ProductsAdmin() {
  const { can } = useAuth();
  const q = useApiQuery<Product[]>(['products'], '/products');
  const [editing, setEditing] = useState<{ id?: number; f: ProductForm } | null>(null);
  const del = useApiMutation((id: number) => api(`/products/${id}`, { method: 'DELETE' }), [['products']]);
  const blank: ProductForm = { name: '', category: 'console', description: '', imageUrl: '', store: 'Amazon', affiliateUrl: '', affiliateProgram: 'Amazon Associados', price: '', priceCheckedAt: null, availability: 'unknown', active: true, sortOrder: 0 };
  return (
    <>
      <div className="admin-head">
        <div>
          <h1>Produtos e links afiliados</h1>
          <p>Vitrine de ofertas. Nada de preços, descontos ou estoque inventados.</p>
        </div>
        {can('commerce:write') && (
          <button type="button" className="btn btn--primary" onClick={() => setEditing({ f: blank })}>
            <Plus size={16} aria-hidden="true" /> Novo produto
          </button>
        )}
      </div>
      <Feedback error={q.error ?? del.error} />
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Produto</th>
              <th>Loja</th>
              <th>Preço</th>
              <th>Disponibilidade</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {q.data?.map((p) => (
              <tr key={p.id}>
                <td>
                  {p.name}
                  <div className="small muted">{PRODUCT_CATEGORY_LABELS[p.category]}</div>
                </td>
                <td>{p.store ?? '—'}</td>
                <td>
                  {p.priceCents != null ? formatMoney(p.priceCents) : '—'}
                  {p.priceCheckedAt && (
                    <div className="small">
                      <Pill tone={p.priceFresh ? 'ok' : 'warn'}>{p.priceFresh ? 'válido' : 'expirado — oculto no site'}</Pill> {formatDateTime(p.priceCheckedAt)}
                    </div>
                  )}
                </td>
                <td>{AVAILABILITY_LABELS[p.availability]}</td>
                <td>{p.active ? <Pill tone="ok">ativo</Pill> : <Pill>inativo</Pill>}</td>
                <td>
                  <div className="actions">
                    {can('commerce:write') && (
                      <button
                        type="button"
                        className="btn btn--ghost btn--sm"
                        onClick={() =>
                          setEditing({
                            id: p.id,
                            f: { name: p.name, category: p.category, description: p.description ?? '', imageUrl: p.imageUrl ?? '', store: p.store ?? '', affiliateUrl: p.affiliateUrl ?? '', affiliateProgram: p.affiliateProgram ?? '', price: p.priceCents != null ? (p.priceCents / 100).toFixed(2).replace('.', ',') : '', priceCheckedAt: p.priceCheckedAt, availability: p.availability, active: p.active, sortOrder: p.sortOrder },
                          })
                        }
                      >
                        Editar
                      </button>
                    )}
                    {can('commerce:write') && (
                      <ConfirmButton message={`Excluir ${p.name}?`} onConfirm={() => del.mutate(p.id)}>
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
                  Nenhum produto. A página de ofertas exibe uma mensagem de “vitrine em montagem”.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {editing && <ProductDialog initial={editing.f} id={editing.id} onClose={() => setEditing(null)} />}
    </>
  );
}

// ---------------- Banners ----------------
interface Banner {
  id: number;
  slot: BannerSlot;
  title: string;
  subtitle: string | null;
  description: string | null;
  imageUrl: string | null;
  ctaLabel: string;
  productId: number | null;
  store: string | null;
  targetUrl: string;
  priority: number;
  startsAt: string | null;
  endsAt: string | null;
  status: BannerStatus;
}
type BannerForm = Omit<Banner, 'id'>;

function BannerDialog({ initial, id, onClose }: { initial: BannerForm; id?: number; onClose: () => void }) {
  const [f, setF] = useState(initial);
  const products = useApiQuery<Product[]>(['products'], '/products');
  const save = useApiMutation(
    () => api(id ? `/banners/${id}` : '/banners', { method: id ? 'PUT' : 'POST', json: { ...f, subtitle: f.subtitle || null, description: f.description || null, imageUrl: f.imageUrl || null, store: f.store || null } }),
    [['banners']],
  );
  return (
    <Dialog title={id ? 'Editar banner' : 'Novo banner'} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate(undefined, { onSuccess: onClose });
        }}
      >
        <Feedback error={save.error} />
        <div className="form-grid">
          <Field label="Posição" htmlFor="b-slot" className="span-2">
            <select id="b-slot" value={f.slot} onChange={(e) => setF({ ...f, slot: e.target.value as BannerSlot })}>
              {BANNER_SLOTS.map((s) => (
                <option key={s} value={s}>
                  {BANNER_SLOT_LABELS[s]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Chamada curta (acima do título)" htmlFor="b-sub">
            <input id="b-sub" value={f.subtitle ?? ''} onChange={(e) => setF({ ...f, subtitle: e.target.value })} />
          </Field>
          <Field label="Título" htmlFor="b-title">
            <input id="b-title" required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
          </Field>
          <Field label="Descrição" htmlFor="b-desc" className="span-2">
            <input id="b-desc" value={f.description ?? ''} onChange={(e) => setF({ ...f, description: e.target.value })} />
          </Field>
          <Field label="Produto vinculado (opcional)" htmlFor="b-prod">
            <select
              id="b-prod"
              value={f.productId ?? ''}
              onChange={(e) => {
                const p = products.data?.find((x) => x.id === Number(e.target.value));
                setF({ ...f, productId: p ? p.id : null, targetUrl: p?.affiliateUrl ?? f.targetUrl, store: p?.store ?? f.store });
              }}
            >
              <option value="">Nenhum</option>
              {products.data?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Loja" htmlFor="b-store">
            <input id="b-store" value={f.store ?? ''} onChange={(e) => setF({ ...f, store: e.target.value })} />
          </Field>
          <Field label="URL afiliada de destino" htmlFor="b-url" className="span-2">
            <input id="b-url" type="url" required value={f.targetUrl} onChange={(e) => setF({ ...f, targetUrl: e.target.value })} />
          </Field>
          <Field label="Texto do botão" htmlFor="b-cta">
            <input id="b-cta" required value={f.ctaLabel} onChange={(e) => setF({ ...f, ctaLabel: e.target.value })} />
          </Field>
          <Field label="Imagem (URL; vazio = ilustração do portal)" htmlFor="b-img">
            <input id="b-img" type="url" value={f.imageUrl ?? ''} onChange={(e) => setF({ ...f, imageUrl: e.target.value })} />
          </Field>
          <Field label="Início da exibição" htmlFor="b-start">
            <input id="b-start" type="datetime-local" value={toLocalInput(f.startsAt)} onChange={(e) => setF({ ...f, startsAt: fromLocalInput(e.target.value) })} />
          </Field>
          <Field label="Fim da exibição" htmlFor="b-end">
            <input id="b-end" type="datetime-local" value={toLocalInput(f.endsAt)} onChange={(e) => setF({ ...f, endsAt: fromLocalInput(e.target.value) })} />
          </Field>
          <Field label="Prioridade (maior aparece primeiro)" htmlFor="b-prio">
            <input id="b-prio" type="number" min={0} max={1000} value={f.priority} onChange={(e) => setF({ ...f, priority: Number(e.target.value) })} />
          </Field>
          <Field label="Status" htmlFor="b-status">
            <select id="b-status" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as BannerStatus })}>
              <option value="draft">Rascunho</option>
              <option value="active">Ativo</option>
              <option value="paused">Pausado</option>
            </select>
          </Field>
        </div>
        <button type="submit" className="btn btn--primary" disabled={save.isPending}>
          Salvar
        </button>
      </form>
    </Dialog>
  );
}

export function BannersAdmin() {
  const { can } = useAuth();
  const q = useApiQuery<Banner[]>(['banners'], '/banners');
  const [editing, setEditing] = useState<{ id?: number; f: BannerForm } | null>(null);
  const del = useApiMutation((id: number) => api(`/banners/${id}`, { method: 'DELETE' }), [['banners']]);
  const blank = (slot: BannerSlot): BannerForm => ({
    slot,
    title: slot === 'home_primary' ? 'Prepare-se para GTA VI' : 'Jogos e acessórios',
    subtitle: slot === 'home_primary' ? 'Consoles' : 'GTA VI, DualSense e mais',
    description: slot === 'home_primary' ? 'Seu próximo grande jogo começa com o setup certo.' : 'Confira jogos, controles e acessórios para sua próxima sessão.',
    imageUrl: null,
    ctaLabel: slot === 'home_primary' ? 'Consultar ofertas de consoles' : 'Ver produtos e preços',
    productId: null,
    store: 'Amazon',
    targetUrl: '',
    priority: 10,
    startsAt: null,
    endsAt: null,
    status: 'draft',
  });
  return (
    <>
      <div className="admin-head">
        <div>
          <h1>Banners da home</h1>
          <p>Dois espaços: consoles (Banner 1) e GTA VI, DualSense e acessórios (Banner 2). Sem banner ativo, a home mostra um espaço reservado que leva à vitrine.</p>
        </div>
        {can('commerce:write') && (
          <div className="row">
            {BANNER_SLOTS.map((s) => (
              <button key={s} type="button" className="btn btn--primary btn--sm" onClick={() => setEditing({ f: blank(s) })}>
                <Plus size={14} aria-hidden="true" /> {s === 'home_primary' ? 'Banner 1' : 'Banner 2'}
              </button>
            ))}
          </div>
        )}
      </div>
      <Feedback error={q.error ?? del.error} />
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Posição</th>
              <th>Título</th>
              <th>Período</th>
              <th className="num">Prioridade</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {q.data?.map((b) => (
              <tr key={b.id}>
                <td className="small">{BANNER_SLOT_LABELS[b.slot]}</td>
                <td>{b.title}</td>
                <td className="small">
                  {b.startsAt ? formatDateTime(b.startsAt) : 'imediato'} → {b.endsAt ? formatDateTime(b.endsAt) : 'sem fim'}
                </td>
                <td className="num">{b.priority}</td>
                <td>
                  <Pill tone={b.status === 'active' ? 'ok' : b.status === 'paused' ? 'warn' : undefined}>{b.status}</Pill>
                </td>
                <td>
                  <div className="actions">
                    {can('commerce:write') && (
                      <button type="button" className="btn btn--ghost btn--sm" onClick={() => setEditing({ id: b.id, f: { ...b } })}>
                        Editar
                      </button>
                    )}
                    {can('commerce:write') && (
                      <ConfirmButton message={`Excluir o banner “${b.title}”?`} onConfirm={() => del.mutate(b.id)}>
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
                  Nenhum banner cadastrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {editing && <BannerDialog initial={editing.f} id={editing.id} onClose={() => setEditing(null)} />}
    </>
  );
}

// ---------------- Canais ----------------
interface Channel {
  id: number;
  kind: ChannelKind;
  label: string;
  url: string;
  description: string | null;
  active: boolean;
}

function ChannelDialog({ initial, id, onClose }: { initial: Omit<Channel, 'id'>; id?: number; onClose: () => void }) {
  const [f, setF] = useState(initial);
  const save = useApiMutation(() => api(id ? `/channels/${id}` : '/channels', { method: id ? 'PUT' : 'POST', json: { ...f, description: f.description || null } }), [['channels']]);
  return (
    <Dialog title={id ? 'Editar canal' : 'Novo canal'} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate(undefined, { onSuccess: onClose });
        }}
      >
        <Feedback error={save.error} />
        <div className="form-grid">
          <Field label="Plataforma" htmlFor="ch-kind">
            <select id="ch-kind" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as ChannelKind })}>
              <option value="telegram">Telegram</option>
              <option value="whatsapp">WhatsApp</option>
            </select>
          </Field>
          <Field label="Texto do botão" htmlFor="ch-label">
            <input id="ch-label" required value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} />
          </Field>
          <Field label="Link de convite oficial" htmlFor="ch-url" hint="t.me/… ou chat.whatsapp.com/… / whatsapp.com/channel/…" className="span-2">
            <input id="ch-url" type="url" required value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} />
          </Field>
          <Field label="Descrição" htmlFor="ch-desc" className="span-2">
            <input id="ch-desc" value={f.description ?? ''} onChange={(e) => setF({ ...f, description: e.target.value })} />
          </Field>
        </div>
        <label className="check" style={{ marginBottom: 14 }}>
          <input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} /> Exibir no site
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

export function ChannelsAdmin() {
  const { can } = useAuth();
  const q = useApiQuery<Channel[]>(['channels'], '/channels');
  const articles = useApiQuery<{ items: { id: number; title: string }[] }>(['articles', 'published', '', 1], '/articles?status=published&pageSize=50');
  const products = useApiQuery<Product[]>(['products'], '/products');
  const [editing, setEditing] = useState<{ id?: number; f: Omit<Channel, 'id'> } | null>(null);
  const [target, setTarget] = useState('');
  const del = useApiMutation((id: number) => api(`/channels/${id}`, { method: 'DELETE' }), [['channels']]);
  const compose = useApiMutation((t: string) => {
    const [kind, idStr] = t.split(':');
    return api<{ telegram: string; whatsapp: string }>('/channels/compose', { method: 'POST', json: { [kind === 'a' ? 'articleId' : 'productId']: Number(idStr), siteUrl: window.location.origin + import.meta.env.BASE_URL.replace(/\/$/, '') } });
  });
  const [copied, setCopied] = useState('');
  const copy = async (k: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(k);
    setTimeout(() => setCopied(''), 2000);
  };
  return (
    <>
      <div className="admin-head">
        <div>
          <h1>Canais de Telegram e WhatsApp</h1>
          <p>Links exibidos no site. Os botões só aparecem para canais ativos. Nunca adicionamos pessoas nem enviamos mensagens em massa.</p>
        </div>
        {can('channels:write') && (
          <button type="button" className="btn btn--primary" onClick={() => setEditing({ f: { kind: 'telegram', label: 'Entrar no Telegram', url: '', description: '', active: true } })}>
            <Plus size={16} aria-hidden="true" /> Novo canal
          </button>
        )}
      </div>
      <Feedback error={q.error ?? del.error} />
      <div className="table-wrap" style={{ marginBottom: 24 }}>
        <table className="table">
          <thead>
            <tr>
              <th>Plataforma</th>
              <th>Botão</th>
              <th>Link</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {q.data?.map((c) => (
              <tr key={c.id}>
                <td>{c.kind === 'telegram' ? 'Telegram' : 'WhatsApp'}</td>
                <td>{c.label}</td>
                <td className="small">
                  <a href={c.url} target="_blank" rel="noopener noreferrer">
                    {c.url}
                  </a>
                </td>
                <td>{c.active ? <Pill tone="ok">ativo</Pill> : <Pill>inativo</Pill>}</td>
                <td>
                  <div className="actions">
                    {can('channels:write') && (
                      <button type="button" className="btn btn--ghost btn--sm" onClick={() => setEditing({ id: c.id, f: { kind: c.kind, label: c.label, url: c.url, description: c.description, active: c.active } })}>
                        Editar
                      </button>
                    )}
                    {can('channels:write') && (
                      <ConfirmButton message="Excluir este canal?" onConfirm={() => del.mutate(c.id)}>
                        Excluir
                      </ConfirmButton>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {q.data?.length === 0 && (
              <tr>
                <td colSpan={5} className="muted">
                  Nenhum canal configurado. A faixa de canais fica oculta no site até você cadastrar um link real.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <section className="panel" aria-label="Preparar mensagem">
        <h2 style={{ fontSize: '1.1rem' }}>Preparar mensagem para os canais</h2>
        <p className="small muted">Gera o texto de divulgação de uma notícia publicada ou de um produto. Copie e publique manualmente no seu canal.</p>
        <div className="row">
          <select className="input" style={{ maxWidth: 480 }} value={target} onChange={(e) => setTarget(e.target.value)} aria-label="Conteúdo a divulgar">
            <option value="">Escolha uma notícia ou produto…</option>
            <optgroup label="Notícias publicadas">
              {articles.data?.items.map((a) => (
                <option key={`a${a.id}`} value={`a:${a.id}`}>
                  {a.title}
                </option>
              ))}
            </optgroup>
            <optgroup label="Produtos">
              {products.data?.map((p) => (
                <option key={`p${p.id}`} value={`p:${p.id}`}>
                  {p.name}
                </option>
              ))}
            </optgroup>
          </select>
          <button type="button" className="btn btn--cyan" disabled={!target || compose.isPending} onClick={() => compose.mutate(target)}>
            Gerar texto
          </button>
        </div>
        <Feedback error={compose.error} />
        {compose.data && (
          <div className="split" style={{ marginTop: 14 }}>
            {(['telegram', 'whatsapp'] as const).map((k) => (
              <div key={k}>
                <div className="row" style={{ marginBottom: 6 }}>
                  <strong>{k === 'telegram' ? 'Telegram' : 'WhatsApp'}</strong>
                  <span className="spacer" />
                  <button type="button" className="btn btn--ghost btn--sm" onClick={() => void copy(k, compose.data![k])}>
                    <Copy size={14} aria-hidden="true" /> {copied === k ? 'Copiado!' : 'Copiar'}
                  </button>
                </div>
                <div className="copy-box">{compose.data[k]}</div>
              </div>
            ))}
          </div>
        )}
      </section>
      {editing && <ChannelDialog initial={editing.f} id={editing.id} onClose={() => setEditing(null)} />}
    </>
  );
}
