import { describe, expect, it } from 'vitest';
import {
  articleInputSchema,
  bannerInputSchema,
  canTransition,
  channelInputSchema,
  hasPermission,
  isPriceFresh,
  isSafeHttpUrl,
  jaccard,
  normalizeUrl,
  slugify,
  titleFingerprint,
} from '../src/index.ts';

describe('slugify', () => {
  it('remove acentos e pontuação', () => {
    expect(slugify('GTA VI: lançamento em 19 de novembro!')).toBe('gta-vi-lancamento-em-19-de-novembro');
    expect(slugify('  Ação & Reação  ')).toBe('acao-e-reacao');
  });
});

describe('normalizeUrl', () => {
  it('unifica protocolo, www, barra final e parâmetros de rastreamento', () => {
    expect(normalizeUrl('http://www.IGN.com/articles/gta-6/?utm_source=x&b=2&a=1#top')).toBe('https://ign.com/articles/gta-6?a=1&b=2');
    expect(normalizeUrl('https://ign.com/articles/gta-6')).toBe('https://ign.com/articles/gta-6');
  });
  it('não quebra com URL inválida', () => {
    expect(normalizeUrl('não é url')).toBe('não é url');
  });
});

describe('similaridade de títulos', () => {
  it('detecta títulos parecidos e ignora stopwords', () => {
    expect(jaccard('GTA 6 leaker threatens to release full build', 'GTA 6 leaker threatens release of full build')).toBeGreaterThan(0.6);
    expect(jaccard('GTA 6 radio stations revealed', 'Xbox denies streaming rights report')).toBeLessThan(0.2);
    expect(titleFingerprint('The GTA VI Trailer')).toBe('trailer');
  });
});

describe('fluxo editorial', () => {
  it('não permite pular a aprovação', () => {
    expect(canTransition('draft', 'published')).toBe(false);
    expect(canTransition('in_review', 'published')).toBe(false);
    expect(canTransition('in_review', 'approved')).toBe(true);
    expect(canTransition('approved', 'published')).toBe(true);
  });
  it('editor aprova mas não publica', () => {
    expect(hasPermission('editor', 'articles:approve')).toBe(true);
    expect(hasPermission('editor', 'articles:publish')).toBe(false);
    expect(hasPermission('viewer', 'articles:write')).toBe(false);
  });
});

describe('preços', () => {
  it('expira após 24 horas', () => {
    const now = new Date('2026-10-12T12:00:00Z');
    expect(isPriceFresh('2026-10-12T00:00:00Z', now)).toBe(true);
    expect(isPriceFresh('2026-10-10T00:00:00Z', now)).toBe(false);
    expect(isPriceFresh(null, now)).toBe(false);
  });
});

describe('validação de entrada', () => {
  it('rejeita URLs não http', () => {
    expect(isSafeHttpUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeHttpUrl('https://amazon.com.br/dp/X')).toBe(true);
  });
  it('canais aceitam apenas links oficiais de convite', () => {
    expect(channelInputSchema.safeParse({ kind: 'telegram', label: 'Telegram', url: 'https://t.me/meucanal', active: true }).success).toBe(true);
    expect(channelInputSchema.safeParse({ kind: 'telegram', label: 'Telegram', url: 'https://example.com/t.me', active: true }).success).toBe(false);
  });
  it('banner exige fim depois do início', () => {
    const base = { slot: 'home_primary', title: 'Banner', ctaLabel: 'Ver', targetUrl: 'https://amazon.com.br/x', status: 'active' };
    expect(bannerInputSchema.safeParse({ ...base, startsAt: '2026-10-10', endsAt: '2026-10-01' }).success).toBe(false);
    expect(bannerInputSchema.safeParse({ ...base, startsAt: '2026-10-01', endsAt: '2026-10-10' }).success).toBe(true);
  });
  it('artigo exige campos mínimos', () => {
    expect(articleInputSchema.safeParse({ title: 'curto', summary: 'x', body: 'y', categorySlug: 'noticias', verificationStatus: 'confirmed', authorName: 'A' }).success).toBe(false);
  });
});
