import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Lock } from 'lucide-react';
import { ADMIN_URL, DATA_MODE } from '../lib/env.ts';
import { useSeo } from '../lib/seo.ts';

/**
 * O painel só funciona quando o site é servido pela API (mesma origem, cookie de sessão).
 * Na versão estática (GitHub Pages) mostramos como chegar ao painel em vez de uma tela quebrada.
 */
export function AdminGate({ children }: { children: ReactNode }) {
  useSeo({ title: 'Painel administrativo', description: 'Acesso restrito à equipe editorial.', path: '/admin', siteName: 'Project GTA IV', noindex: true });
  if (DATA_MODE === 'api') return <>{children}</>;
  return (
    <div className="container section" style={{ maxWidth: 640 }}>
      <div className="state">
        <Lock size={36} aria-hidden="true" />
        <h1 style={{ fontSize: '1.6rem', margin: 0 }}>Painel administrativo</h1>
        <p>
          Esta é a versão pública e estática do site. O painel editorial roda no servidor da API, que guarda os dados e valida as permissões.
        </p>
        {ADMIN_URL ? (
          <a className="btn btn--primary" href={ADMIN_URL}>
            Ir para o painel
          </a>
        ) : (
          <p className="small muted">
            O endereço do painel ainda não foi configurado (variável <code>VITE_ADMIN_URL</code>). Consulte o README do projeto para publicar a API.
          </p>
        )}
        <Link to="/" className="link-arrow">
          Voltar ao site
        </Link>
      </div>
    </div>
  );
}
