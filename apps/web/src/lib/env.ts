/** Configuração de build do frontend. Nenhum segredo vive aqui: tudo é público. */

export type DataMode = 'api' | 'snapshot';

export const BASE = import.meta.env.BASE_URL; // sempre termina com "/"
export const DATA_MODE: DataMode = import.meta.env.VITE_DATA_MODE === 'api' ? 'api' : 'snapshot';
/** Origem da API. Vazio = mesma origem do site (quando a API serve o frontend). */
export const API_URL: string = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');
/** Endereço do painel administrativo quando o site público é estático (ex.: GitHub Pages). */
export const ADMIN_URL: string = import.meta.env.VITE_ADMIN_URL ?? '';
/** URL canônica do site (para SEO). */
export const SITE_URL: string = (import.meta.env.VITE_SITE_URL ?? '').replace(/\/$/, '');

/** Monta um caminho interno respeitando o base path (GitHub Pages usa /<repo>/). */
export function asset(path: string): string {
  return `${BASE}${path.replace(/^\//, '')}`;
}

export function canonical(path: string): string {
  const base = SITE_URL || (typeof window !== 'undefined' ? window.location.origin + BASE.replace(/\/$/, '') : '');
  return `${base}${path}`;
}
