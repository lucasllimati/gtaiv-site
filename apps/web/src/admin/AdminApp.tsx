import { createContext, useContext, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { NavLink, Route, Routes, useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import {
  BarChart3,
  Bug,
  ExternalLink,
  FileText,
  Film,
  History,
  Image,
  Inbox,
  LayoutDashboard,
  Library,
  LogOut,
  Megaphone,
  Radio,
  Rss,
  Settings,
  ShoppingBag,
  Users,
  Workflow,
} from 'lucide-react';
import type { Permission } from '@pgi/shared';
import { BrandMark } from '../components/Art.tsx';
import { useSeo } from '../lib/seo.ts';
import { api, errorText, setCsrf, type Me } from './api.ts';
import './admin.css';
import { Dashboard } from './pages/Dashboard.tsx';
import { Queue } from './pages/Queue.tsx';
import { ArticleList, ArticleEditor } from './pages/Articles.tsx';
import { SourcesPage, PipelinePage } from './pages/Sources.tsx';
import { GuideAdmin, DiscoveriesAdmin } from './pages/Content.tsx';
import { ProductsAdmin, BannersAdmin, ChannelsAdmin } from './pages/Commerce.tsx';
import { MediaAdmin } from './pages/Media.tsx';
import { StudioPage } from './pages/Studio.tsx';
import { MetricsPage, AuditPage, UsersAdmin, SettingsAdmin } from './pages/System.tsx';

interface AuthCtx {
  me: Me;
  can: (p: Permission) => boolean;
  logout: () => Promise<void>;
}
const Ctx = createContext<AuthCtx | null>(null);
export function useAuth(): AuthCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth fora do provedor');
  return v;
}

function Login({ onLogin }: { onLogin: (me: Me) => void }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError('');
    try {
      await api('/auth/login', { method: 'POST', json: { email: f.get('email'), password: f.get('password') } });
      const me = await api<Me>('/auth/me');
      setCsrf(me.csrfToken);
      onLogin(me);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="admin-login">
      <form className="panel" onSubmit={submit} style={{ width: '100%', maxWidth: 400 }}>
        <div className="row" style={{ marginBottom: 18 }}>
          <BrandMark className="brand__mark" />
          <div>
            <h1 style={{ fontSize: '1.3rem', margin: 0 }}>Painel editorial</h1>
            <div className="muted small">Acesso restrito à equipe</div>
          </div>
        </div>
        {error && (
          <div className="alert alert--error" role="alert">
            {error}
          </div>
        )}
        <div className="field">
          <label htmlFor="email">E-mail</label>
          <input id="email" name="email" type="email" autoComplete="username" required maxLength={200} />
        </div>
        <div className="field">
          <label htmlFor="password">Senha</label>
          <input id="password" name="password" type="password" autoComplete="current-password" required maxLength={200} />
        </div>
        <button className="btn btn--primary btn--block" disabled={busy}>
          {busy ? 'Entrando…' : 'Entrar'}
        </button>
        <p className="small muted" style={{ marginTop: 14, marginBottom: 0 }}>
          O primeiro administrador é criado pelo terminal: <code>npm run admin:create</code>.
        </p>
      </form>
    </div>
  );
}

const MENU: { to: string; label: string; icon: ReactNode; perm: Permission; end?: boolean }[] = [
  { to: '', label: 'Dashboard', icon: <LayoutDashboard size={17} />, perm: 'metrics:read', end: true },
  { to: 'fila', label: 'Fila de revisão', icon: <Inbox size={17} />, perm: 'articles:read' },
  { to: 'artigos', label: 'Artigos', icon: <FileText size={17} />, perm: 'articles:read' },
  { to: 'guia', label: 'Guia do universo', icon: <Library size={17} />, perm: 'articles:read' },
  { to: 'descobertas', label: 'Descobertas', icon: <Bug size={17} />, perm: 'articles:read' },
  { to: 'estudio', label: 'Estúdio social', icon: <Film size={17} />, perm: 'articles:read' },
  { to: 'midia', label: 'Biblioteca de mídia', icon: <Image size={17} />, perm: 'articles:read' },
  { to: 'fontes', label: 'Fontes', icon: <Rss size={17} />, perm: 'articles:read' },
  { to: 'pipeline', label: 'Execuções e logs', icon: <Workflow size={17} />, perm: 'articles:read' },
  { to: 'produtos', label: 'Produtos e afiliados', icon: <ShoppingBag size={17} />, perm: 'articles:read' },
  { to: 'banners', label: 'Banners da home', icon: <Megaphone size={17} />, perm: 'articles:read' },
  { to: 'canais', label: 'Canais', icon: <Radio size={17} />, perm: 'articles:read' },
  { to: 'metricas', label: 'Métricas', icon: <BarChart3 size={17} />, perm: 'metrics:read' },
  { to: 'auditoria', label: 'Auditoria', icon: <History size={17} />, perm: 'audit:read' },
  { to: 'usuarios', label: 'Usuários', icon: <Users size={17} />, perm: 'users:manage' },
  { to: 'config', label: 'Configurações', icon: <Settings size={17} />, perm: 'articles:read' },
];

export default function AdminApp() {
  const [me, setMe] = useState<Me | null>(null);
  const [checking, setChecking] = useState(true);
  const qc = useQueryClient();
  const navigate = useNavigate();
  useSeo({ title: 'Painel', description: 'Painel administrativo', path: '/admin', siteName: 'Project GTA IV', noindex: true });

  useEffect(() => {
    api<Me>('/auth/me')
      .then((m) => {
        setCsrf(m.csrfToken);
        setMe(m);
      })
      .catch(() => setMe(null))
      .finally(() => setChecking(false));
  }, []);

  // Sessão expirada em qualquer requisição → volta ao login.
  useEffect(() => {
    return qc.getQueryCache().subscribe((ev) => {
      const err = ev.query.state.error as { status?: number } | null;
      if (err?.status === 401) setMe(null);
    });
  }, [qc]);

  if (checking) return <div className="admin-login" role="status">Verificando sessão…</div>;
  if (!me) return <Login onLogin={setMe} />;

  const can = (p: Permission) => me.permissions.includes(p);
  const logout = async () => {
    await api('/auth/logout', { method: 'POST' }).catch(() => undefined);
    setCsrf('');
    qc.clear();
    setMe(null);
    navigate('/admin');
  };

  return (
    <Ctx.Provider value={{ me, can, logout }}>
      <div className="admin">
        <aside className="admin__side" aria-label="Menu do painel">
          <div className="row" style={{ padding: '4px 8px 16px' }}>
            <BrandMark className="brand__mark" />
            <div>
              <div style={{ fontWeight: 800, fontFamily: 'var(--font-display)' }}>Painel</div>
              <div className="muted small">{me.user.name}</div>
            </div>
          </div>
          <nav>
            {MENU.filter((m) => can(m.perm)).map((m) => (
              <NavLink key={m.to} to={m.to} end={m.end}>
                {m.icon}
                {m.label}
              </NavLink>
            ))}
          </nav>
          <div className="admin__side-foot">
            <a href={import.meta.env.BASE_URL} target="_blank" rel="noopener noreferrer">
              <ExternalLink size={16} /> Ver site
            </a>
            <button type="button" onClick={() => void logout()}>
              <LogOut size={16} /> Sair
            </button>
          </div>
        </aside>
        <main className="admin__main" id="conteudo">
          <Routes>
            <Route index element={<Dashboard />} />
            <Route path="fila" element={<Queue />} />
            <Route path="artigos" element={<ArticleList />} />
            <Route path="artigos/novo" element={<ArticleEditor />} />
            <Route path="artigos/:id" element={<ArticleEditor />} />
            <Route path="guia" element={<GuideAdmin />} />
            <Route path="descobertas" element={<DiscoveriesAdmin />} />
            <Route path="estudio" element={<StudioPage />} />
            <Route path="estudio/:id" element={<StudioPage />} />
            <Route path="midia" element={<MediaAdmin />} />
            <Route path="fontes" element={<SourcesPage />} />
            <Route path="pipeline" element={<PipelinePage />} />
            <Route path="produtos" element={<ProductsAdmin />} />
            <Route path="banners" element={<BannersAdmin />} />
            <Route path="canais" element={<ChannelsAdmin />} />
            <Route path="metricas" element={<MetricsPage />} />
            <Route path="auditoria" element={<AuditPage />} />
            <Route path="usuarios" element={<UsersAdmin />} />
            <Route path="config" element={<SettingsAdmin />} />
            <Route path="*" element={<p>Página não encontrada.</p>} />
          </Routes>
        </main>
      </div>
    </Ctx.Provider>
  );
}
