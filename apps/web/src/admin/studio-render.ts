import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NeonScene } from '../components/Art.tsx';

/**
 * Renderização local (no navegador) das artes e do vídeo curto do estúdio.
 * Sem custo de servidor e sem serviços externos. As artes usam somente a
 * ilustração original do portal e tipografia própria.
 */

export const FORMATS = [
  { key: '1x1', label: 'Feed 1:1', w: 1080, h: 1080 },
  { key: '4x5', label: 'Feed 4:5', w: 1080, h: 1350 },
  { key: '9x16', label: 'Stories / Reels / Shorts 9:16', w: 1080, h: 1920 },
  { key: '16x9', label: 'YouTube / artigo 16:9', w: 1920, h: 1080 },
] as const;
export type FormatKey = (typeof FORMATS)[number]['key'];

export interface ArtInput {
  headline: string;
  kicker: string;
  statusLabel: string;
  statusColor: string;
  siteName: string;
  sourceLine: string;
  seed: string;
  speculative: boolean;
}

const bgCache = new Map<string, Promise<HTMLImageElement>>();
function backgroundImage(seed: string, variant: number): Promise<HTMLImageElement> {
  const key = `${seed}:${variant}`;
  let p = bgCache.get(key);
  if (!p) {
    const svg = renderToStaticMarkup(createElement(NeonScene, { seed, variant }));
    const withNs = svg.includes('xmlns=') ? svg : svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
    const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(withNs)}`;
    p = new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Falha ao gerar o fundo'));
      img.src = url;
    });
    bgCache.set(key, p);
  }
  return p;
}

export async function ensureFonts(): Promise<void> {
  await Promise.all([document.fonts.load('900 64px "Montserrat Variable"'), document.fonts.load('600 32px "Inter Variable"')]).catch(() => undefined);
}

function cover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, w: number, h: number) {
  const iw = img.naturalWidth || 1600;
  const ih = img.naturalHeight || 900;
  const s = Math.max(w / iw, h / ih);
  ctx.drawImage(img, (w - iw * s) / 2, (h - ih * s) / 2, iw * s, ih * s);
}

export function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
      if (lines.length === maxLines) break;
    } else line = test;
  }
  if (lines.length < maxLines && line) lines.push(line);
  if (lines.length === maxLines && words.join(' ').length > lines.join(' ').length) {
    lines[maxLines - 1] = `${lines[maxLines - 1]!.replace(/\s+\S*$/, '')}…`;
  }
  return lines;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** Desenha uma arte estática. Retorna o canvas pronto para exportar. */
export async function drawArt(canvas: HTMLCanvasElement, fmt: { w: number; h: number }, input: ArtInput): Promise<void> {
  await ensureFonts();
  canvas.width = fmt.w;
  canvas.height = fmt.h;
  const ctx = canvas.getContext('2d')!;
  const bg = await backgroundImage(input.seed, 0);
  cover(ctx, bg, fmt.w, fmt.h);

  const landscape = fmt.w > fmt.h;
  const pad = Math.round(Math.min(fmt.w, fmt.h) * 0.07);
  const grad = landscape ? ctx.createLinearGradient(0, 0, fmt.w, 0) : ctx.createLinearGradient(0, fmt.h, 0, 0);
  grad.addColorStop(0, 'rgba(7,11,26,0.96)');
  grad.addColorStop(landscape ? 0.55 : 0.55, 'rgba(7,11,26,0.78)');
  grad.addColorStop(1, 'rgba(7,11,26,0.05)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, fmt.w, fmt.h);

  const textW = landscape ? fmt.w * 0.58 : fmt.w - pad * 2;
  const base = Math.min(fmt.w, fmt.h);
  const headSize = Math.round(base * (landscape ? 0.085 : fmt.h / fmt.w > 1.5 ? 0.095 : 0.088));

  // Selo de status
  ctx.font = `800 ${Math.round(base * 0.032)}px "Inter Variable", sans-serif`;
  const label = input.statusLabel.toUpperCase();
  const lw = ctx.measureText(label).width + base * 0.05;
  const lh = base * 0.06;
  let y = landscape ? fmt.h * 0.3 : fmt.h * (fmt.h / fmt.w > 1.5 ? 0.52 : 0.42);
  roundRect(ctx, pad, y, lw, lh, lh / 2);
  ctx.fillStyle = input.statusColor;
  ctx.fill();
  ctx.fillStyle = '#05070f';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, pad + base * 0.025, y + lh / 2 + 1);

  // Kicker
  y += lh + base * 0.045;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#00e5ff';
  ctx.font = `800 ${Math.round(base * 0.034)}px "Montserrat Variable", sans-serif`;
  ctx.fillText(input.kicker.toUpperCase(), pad, y);

  // Manchete
  ctx.font = `900 ${headSize}px "Montserrat Variable", sans-serif`;
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 20;
  const lines = wrapLines(ctx, input.headline, textW, landscape ? 4 : 5);
  for (const l of lines) {
    y += headSize * 1.08;
    ctx.fillText(l, pad, y);
  }
  ctx.shadowBlur = 0;

  // Aviso de especulação
  if (input.speculative) {
    y += base * 0.06;
    ctx.font = `700 ${Math.round(base * 0.028)}px "Inter Variable", sans-serif`;
    ctx.fillStyle = '#ffc53d';
    ctx.fillText('Informação não confirmada oficialmente', pad, y);
  }

  // Rodapé: marca + fonte
  const footY = fmt.h - pad;
  ctx.fillStyle = '#ff2d9b';
  ctx.fillRect(pad, footY - base * 0.085, base * 0.012, base * 0.085);
  ctx.font = `900 ${Math.round(base * 0.036)}px "Montserrat Variable", sans-serif`;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(input.siteName.toUpperCase(), pad + base * 0.03, footY - base * 0.045);
  ctx.font = `500 ${Math.round(base * 0.024)}px "Inter Variable", sans-serif`;
  ctx.fillStyle = '#c3cce3';
  ctx.fillText(input.sourceLine, pad + base * 0.03, footY - base * 0.005, fmt.w - pad * 2 - base * 0.03);
}

export function canvasToBlob(canvas: HTMLCanvasElement, type = 'image/png'): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Falha ao exportar'))), type, 0.92));
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export interface Scene {
  caption: string;
  visual: string;
  seconds: number;
}

export function videoSupported(): boolean {
  return typeof MediaRecorder !== 'undefined' && typeof HTMLCanvasElement.prototype.captureStream === 'function';
}

function pickMime(): string {
  const options = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
  return options.find((m) => MediaRecorder.isTypeSupported(m)) ?? 'video/webm';
}

/**
 * Renderiza um vídeo vertical 1080×1920 a partir das cenas do roteiro:
 * fundo animado (zoom lento), legenda por cena com transição de fade,
 * barra de progresso e tela final com a marca. Grava em WebM via MediaRecorder.
 * A narração não é embutida: grave-a à parte com o texto do roteiro.
 */
export async function renderVideo(canvas: HTMLCanvasElement, scenes: Scene[], input: ArtInput, onProgress: (p: number) => void): Promise<Blob> {
  await ensureFonts();
  const W = 1080;
  const H = 1920;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const bgs = await Promise.all([0, 1, 2, 3].map((v) => backgroundImage(input.seed, v)));
  const total = scenes.reduce((s, x) => s + x.seconds, 0) * 1000;
  const stream = canvas.captureStream(30);
  const rec = new MediaRecorder(stream, { mimeType: pickMime(), videoBitsPerSecond: 6_000_000 });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const done = new Promise<Blob>((resolve) => (rec.onstop = () => resolve(new Blob(chunks, { type: 'video/webm' }))));

  const starts: number[] = [];
  scenes.reduce((acc, s) => (starts.push(acc), acc + s.seconds * 1000), 0);
  const FADE = 400;

  const draw = (t: number) => {
    let i = starts.findIndex((s, k) => t >= s && t < (starts[k + 1] ?? Infinity));
    if (i < 0) i = scenes.length - 1;
    const scene = scenes[i]!;
    const local = t - starts[i]!;
    const dur = scene.seconds * 1000;
    const zoom = 1 + 0.08 * (local / dur);
    const bg = bgs[i % bgs.length]!;
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-W / 2, -H / 2);
    cover(ctx, bg, W, H);
    ctx.restore();
    const g = ctx.createLinearGradient(0, H, 0, 0);
    g.addColorStop(0, 'rgba(7,11,26,0.95)');
    g.addColorStop(0.6, 'rgba(7,11,26,0.55)');
    g.addColorStop(1, 'rgba(7,11,26,0.25)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // Selo e marca no topo
    ctx.font = '800 34px "Inter Variable", sans-serif';
    const label = input.statusLabel.toUpperCase();
    const lw = ctx.measureText(label).width + 50;
    roundRect(ctx, 70, 110, lw, 64, 32);
    ctx.fillStyle = input.statusColor;
    ctx.fill();
    ctx.fillStyle = '#05070f';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 95, 143);
    ctx.textBaseline = 'alphabetic';
    ctx.font = '900 40px "Montserrat Variable", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(input.siteName.toUpperCase(), 70, 250);

    // Legenda da cena com fade
    const alpha = Math.min(1, local / FADE, (dur - local) / FADE);
    ctx.globalAlpha = Math.max(0, alpha);
    ctx.font = '900 84px "Montserrat Variable", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 24;
    const lines = wrapLines(ctx, scene.caption, W - 140, 6);
    let y = H * 0.62 - (lines.length * 92) / 2;
    for (const l of lines) {
      ctx.fillText(l, 70, y);
      y += 92;
    }
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;

    if (input.speculative) {
      ctx.font = '700 32px "Inter Variable", sans-serif';
      ctx.fillStyle = '#ffc53d';
      ctx.fillText('Informação não confirmada oficialmente', 70, H - 230);
    }
    ctx.font = '500 30px "Inter Variable", sans-serif';
    ctx.fillStyle = '#c3cce3';
    ctx.fillText(input.sourceLine, 70, H - 170, W - 140);

    // Barra de progresso
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(70, H - 110, W - 140, 10);
    const pg = ctx.createLinearGradient(70, 0, W - 70, 0);
    pg.addColorStop(0, '#ff2d9b');
    pg.addColorStop(1, '#00e5ff');
    ctx.fillStyle = pg;
    ctx.fillRect(70, H - 110, (W - 140) * Math.min(1, t / total), 10);
  };

  draw(0);
  rec.start(500);
  const t0 = performance.now();
  await new Promise<void>((resolve) => {
    const tick = () => {
      const t = performance.now() - t0;
      draw(Math.min(t, total - 1));
      onProgress(Math.min(1, t / total));
      if (t >= total) resolve();
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  rec.stop();
  stream.getTracks().forEach((tr) => tr.stop());
  return done;
}
