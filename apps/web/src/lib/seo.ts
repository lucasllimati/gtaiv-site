import { useEffect } from 'react';
import { canonical } from './env.ts';

export interface SeoInput {
  title: string;
  description: string;
  path: string;
  siteName: string;
  type?: 'website' | 'article';
  image?: string | null;
  publishedAt?: string;
  updatedAt?: string;
  noindex?: boolean;
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
}

function setMeta(attr: 'name' | 'property', key: string, value: string | null) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (value == null) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', value);
}

/** Atualiza título, descrição, Open Graph, canonical e JSON-LD da página atual. */
export function useSeo(input: SeoInput | null): void {
  useEffect(() => {
    if (!input) return;
    const fullTitle = input.title === input.siteName ? input.title : `${input.title} | ${input.siteName}`;
    document.title = fullTitle;
    const url = canonical(input.path);
    setMeta('name', 'description', input.description);
    setMeta('name', 'robots', input.noindex ? 'noindex, nofollow' : 'index, follow');
    setMeta('property', 'og:title', fullTitle);
    setMeta('property', 'og:description', input.description);
    setMeta('property', 'og:type', input.type ?? 'website');
    setMeta('property', 'og:url', url);
    setMeta('property', 'og:site_name', input.siteName);
    setMeta('property', 'og:locale', 'pt_BR');
    setMeta('property', 'og:image', input.image ?? null);
    setMeta('name', 'twitter:card', input.image ? 'summary_large_image' : 'summary');
    setMeta('property', 'article:published_time', input.publishedAt ?? null);
    setMeta('property', 'article:modified_time', input.updatedAt ?? null);

    let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'canonical';
      document.head.appendChild(link);
    }
    link.href = url;

    document.head.querySelectorAll('script[data-seo="jsonld"]').forEach((s) => s.remove());
    if (input.jsonLd) {
      const s = document.createElement('script');
      s.type = 'application/ld+json';
      s.dataset.seo = 'jsonld';
      s.textContent = JSON.stringify(input.jsonLd).replace(/</g, '\\u003c');
      document.head.appendChild(s);
    }
  }, [input?.title, input?.description, input?.path, input?.image, input?.siteName, input?.noindex]); // eslint-disable-line react-hooks/exhaustive-deps
}
