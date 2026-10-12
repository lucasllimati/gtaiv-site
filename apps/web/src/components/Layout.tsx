import { useEffect, useState, type FormEvent } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { AlertTriangle, Menu, Rss, Search, X } from 'lucide-react';
import { isStale, trackView, useSite } from '../lib/data.ts';
import { asset } from '../lib/env.ts';
import { formatDateTime } from '../lib/format.ts';
import { BrandMark } from './Art.tsx';

export const NAV = [
  { to: '/', label: 'Início', end: true },
  { to: '/noticias', label: 'Notícias' },
  { to: '/oficiais', label: 'Oficiais' },
  { to: '/rumores', label: 'Rumores' },
  { to: '/universo', label: 'Universo' },
  { to: '/glitches', label: 'Glitches' },
  { to: '/guias', label: 'Guias' },
  { to: '/ofertas', label: 'Ofertas' },
];

function SearchBox({ onDone }: { onDone?: () => void }) {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const term = q.trim();
    if (!term) return;
    navigate(`/busca?q=${encodeURIComponent(term)}`);
    onDone?.();
  };
  return (
    <form className="header-search" role="search" onSubmit={submit}>
      <Search size={16} aria-hidden="true" />
      <label className="sr-only" htmlFor="site-search">
        Buscar no site
      </label>
      <input id="site-search" type="search" placeholder="Buscar no site…" value={q} onChange={(e) => setQ(e.target.value)} maxLength={120} />
    </form>
  );
}

function Header({ siteName }: { siteName: string }) {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  useEffect(() => setOpen(false), [location.pathname]);
  return (
    <header className="site-header">
      <div className="container site-header__inner">
        <Link to="/" className="brand" aria-label={`${siteName} — página inicial`}>
          <BrandMark className="brand__mark" />
          <span className="brand__text">
            <span className="brand__name">{siteName}</span>
            <span className="brand__tag">Intel independente</span>
          </span>
        </Link>
        <nav className="main-nav" aria-label="Principal">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end}>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <SearchBox />
        <button type="button" className="icon-btn menu-toggle" aria-expanded={open} aria-controls="mobile-nav" onClick={() => setOpen((o) => !o)}>
          {open ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
          <span className="sr-only">{open ? 'Fechar menu' : 'Abrir menu'}</span>
        </button>
      </div>
      <div id="mobile-nav" className="mobile-nav container" data-open={open}>
        <nav aria-label="Menu móvel">
          <ul>
            {[...NAV, { to: '/busca', label: 'Buscar' }].map((n) => (
              <li key={n.to}>
                <NavLink to={n.to} end={'end' in n ? n.end : undefined}>
                  {n.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}

function Footer({ siteName, contactEmail }: { siteName: string; contactEmail: string }) {
  const year = new Date().getFullYear();
  return (
    <footer className="site-footer">
      <div className="container site-footer__top">
        <div>
          <Link to="/" className="brand" aria-label={siteName}>
            <BrandMark className="brand__mark" />
            <span className="brand__text">
              <span className="brand__name">{siteName}</span>
            </span>
          </Link>
          <p className="site-footer__about" style={{ marginTop: 14 }}>
            Portal editorial independente sobre GTA VI. Cada notícia mostra a fonte, a data e o status de verificação.
          </p>
          <a href={asset('rss.xml')} className="row small" style={{ gap: 6 }}>
            <Rss size={15} aria-hidden="true" /> Feed RSS
          </a>
        </div>
        <div>
          <h2>Conteúdo</h2>
          <ul>
            <li><Link to="/noticias">Últimas notícias</Link></li>
            <li><Link to="/oficiais">Notícias oficiais</Link></li>
            <li><Link to="/rumores">Rumores e teorias</Link></li>
            <li><Link to="/glitches">Glitches e descobertas</Link></li>
            <li><Link to="/guias">Guias e FAQ</Link></li>
          </ul>
        </div>
        <div>
          <h2>Universo GTA VI</h2>
          <ul>
            <li><Link to="/historia">História e cronologia</Link></li>
            <li><Link to="/personagens">Personagens</Link></li>
            <li><Link to="/mapa">Mapa e locais</Link></li>
            <li><Link to="/universo">Veículos e atividades</Link></li>
            <li><Link to="/ofertas">Ofertas</Link></li>
          </ul>
        </div>
        <div>
          <h2>Institucional</h2>
          <ul>
            <li><Link to="/sobre">Sobre e critérios editoriais</Link></li>
            <li><Link to="/contato">Contato</Link></li>
            <li><Link to="/politica-de-privacidade">Política de privacidade</Link></li>
            <li><Link to="/termos">Termos de uso</Link></li>
            <li><Link to="/divulgacao">Publicidade e afiliados</Link></li>
          </ul>
        </div>
      </div>
      <div className="container site-footer__legal">
        <p style={{ margin: 0 }}>
          © {year} {siteName}. Portal independente, <strong>sem vínculo</strong> com Rockstar Games, Take-Two Interactive, Sony, Microsoft ou Amazon.
          Grand Theft Auto, GTA e marcas relacionadas pertencem aos seus respectivos donos.
        </p>
        <p style={{ margin: 0 }}>
          Alguns links são de afiliados: podemos receber comissão por compras qualificadas, sem custo extra para você. <Link to="/divulgacao">Saiba mais</Link>.
          {contactEmail && (
            <>
              {' '}Contato: <a href={`mailto:${contactEmail}`}>{contactEmail}</a>.
            </>
          )}
        </p>
      </div>
    </footer>
  );
}

export function Layout() {
  const site = useSite();
  const location = useLocation();
  const siteName = site.data?.settings.siteName ?? 'Project GTA IV';

  useEffect(() => {
    window.scrollTo({ top: 0 });
    trackView(location.pathname);
  }, [location.pathname]);

  const stale = site.data && (site.data.fallback || isStale(site.data.generatedAt));

  return (
    <>
      <a href="#conteudo" className="skip-link">
        Pular para o conteúdo
      </a>
      <Header siteName={siteName} />
      {stale && (
        <div className="notice-bar" role="status">
          <div className="container">
            <AlertTriangle size={16} aria-hidden="true" />
            <span>
              {site.data!.fallback ? 'Não foi possível carregar os dados ao vivo. ' : ''}
              Exibindo a última versão publicada ({formatDateTime(site.data!.generatedAt)}). Algumas informações podem estar desatualizadas.
            </span>
          </div>
        </div>
      )}
      <main id="conteudo" tabIndex={-1}>
        <Outlet />
      </main>
      <Footer siteName={siteName} contactEmail={site.data?.settings.contactEmail ?? ''} />
    </>
  );
}
