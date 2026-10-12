// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { renderMarkdown } from '../src/lib/markdown.ts';
import { daysUntil, parsePtDate } from '../src/lib/format.ts';
import { outboundHref, isStale } from '../src/lib/data.ts';

describe('renderMarkdown', () => {
  it('escapa HTML bruto e remove scripts', () => {
    const html = renderMarkdown('Olá <script>alert(1)</script> <img src=x onerror=alert(1)>');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;script&gt;');
  });
  it('bloqueia links javascript:', () => {
    const html = renderMarkdown('[clique](javascript:alert(1))');
    expect(html).not.toContain('javascript:');
  });
  it('links externos abrem em nova aba com rel seguro', () => {
    const html = renderMarkdown('[fonte](https://www.rockstargames.com/VI)');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });
});

describe('datas', () => {
  it('interpreta a data do fato configurado', () => {
    expect(parsePtDate('19 de novembro de 2026')).toBe('2026-11-19');
    expect(parsePtDate('em breve')).toBeNull();
  });
  it('calcula a contagem regressiva no fuso de São Paulo', () => {
    expect(daysUntil('2026-11-19', new Date('2026-10-12T15:00:00Z'))).toBe(38);
  });
});

describe('dados', () => {
  it('no modo estático os links de afiliado vão direto ao destino', () => {
    expect(outboundHref('product', 1, 'https://amazon.com.br/x', 'home')).toBe('https://amazon.com.br/x');
  });
  it('sinaliza snapshot antigo', () => {
    expect(isStale('2026-10-01T00:00:00Z', Date.parse('2026-10-12T00:00:00Z'))).toBe(true);
    expect(isStale('2026-10-11T00:00:00Z', Date.parse('2026-10-12T00:00:00Z'))).toBe(false);
  });
});
