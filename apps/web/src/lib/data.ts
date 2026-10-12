import { useQuery } from '@tanstack/react-query';
import type { PublicArticle, PublicSiteData } from '@pgi/shared';
import { API_URL, DATA_MODE, asset } from './env.ts';

/** Snapshot com mais de 3 dias é sinalizado ao leitor como possivelmente desatualizado. */
export const STALE_AFTER_MS = 3 * 86_400_000;

export class NotFoundError extends Error {}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (res.status === 404) throw new NotFoundError('Não encontrado');
  if (!res.ok) throw new Error(`Falha ao carregar (${res.status})`);
  return (await res.json()) as T;
}

export interface SiteResult extends PublicSiteData {
  /** true quando a API falhou e o site caiu para o snapshot estático. */
  fallback: boolean;
}

export async function fetchSite(): Promise<SiteResult> {
  if (DATA_MODE === 'api') {
    try {
      return { ...(await getJson<PublicSiteData>(`${API_URL}/api/public/site`)), fallback: false };
    } catch {
      // Preserva a última versão válida publicada como snapshot.
      return { ...(await getJson<PublicSiteData>(asset('data/site.json'))), fallback: true };
    }
  }
  return { ...(await getJson<PublicSiteData>(asset('data/site.json'))), fallback: false };
}

export async function fetchArticle(slug: string): Promise<PublicArticle> {
  if (!/^[a-z0-9-]{1,100}$/.test(slug)) throw new NotFoundError('Slug inválido');
  if (DATA_MODE === 'api') {
    try {
      return await getJson<PublicArticle>(`${API_URL}/api/public/articles/${slug}`);
    } catch (err) {
      if (err instanceof NotFoundError) throw err;
    }
  }
  return getJson<PublicArticle>(asset(`data/articles/${slug}.json`));
}

export function useSite() {
  return useQuery({ queryKey: ['site'], queryFn: fetchSite, staleTime: 60_000 });
}

export function useArticle(slug: string) {
  return useQuery({
    queryKey: ['article', slug],
    queryFn: () => fetchArticle(slug),
    staleTime: 60_000,
    retry: (count, err) => !(err instanceof NotFoundError) && count < 2,
  });
}

export function isStale(generatedAt: string, now = Date.now()): boolean {
  return now - Date.parse(generatedAt) > STALE_AFTER_MS;
}

/**
 * Link de saída para afiliados/canais. Com a API ativa, passa pelo redirecionador
 * que contabiliza o clique (sem dados pessoais). No site estático, vai direto ao destino.
 */
export function outboundHref(type: 'banner' | 'product' | 'channel', id: number, url: string, placement: string): string {
  if (DATA_MODE === 'api') return `${API_URL}/go/${type}/${id}?p=${encodeURIComponent(placement)}`;
  return url;
}

/** Registra uma visita agregada (apenas caminho e dia). Só no modo API. */
export function trackView(path: string): void {
  if (DATA_MODE !== 'api') return;
  try {
    void fetch(`${API_URL}/api/public/view`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: path.slice(0, 200) }),
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    /* métricas nunca quebram a navegação */
  }
}
