import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { Config } from '../config.ts';

export interface MediaStorage {
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  remove(key: string): Promise<void>;
  url(key: string): string;
  /** Apenas no driver local: lê o arquivo para servir via /media. */
  read?(key: string): Promise<Buffer>;
}

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');

/** Tipos aceitos, identificados pelos primeiros bytes do arquivo (não pela extensão enviada). */
const SIGNATURES: { mime: string; ext: string; test: (b: Buffer) => boolean }[] = [
  { mime: 'image/png', ext: 'png', test: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { mime: 'image/jpeg', ext: 'jpg', test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: 'image/webp', ext: 'webp', test: (b) => b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP' },
  { mime: 'image/gif', ext: 'gif', test: (b) => b.subarray(0, 6).toString('latin1').startsWith('GIF8') },
  { mime: 'video/webm', ext: 'webm', test: (b) => b.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3])) },
  { mime: 'video/mp4', ext: 'mp4', test: (b) => b.subarray(4, 8).toString('latin1') === 'ftyp' },
];

export function sniffMedia(buf: Buffer): { mime: string; ext: string } | null {
  const hit = SIGNATURES.find((s) => s.test(buf));
  return hit ? { mime: hit.mime, ext: hit.ext } : null;
}

/** Lê largura/altura de PNG e JPEG sem dependências externas. */
export function imageSize(buf: Buffer, mime: string): { width: number; height: number } | null {
  if (mime === 'image/png' && buf.length >= 24) return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  if (mime === 'image/jpeg') {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) return null;
      const marker = buf[i + 1]!;
      const len = buf.readUInt16BE(i + 2);
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
      }
      i += 2 + len;
    }
  }
  return null;
}

class LocalStorage implements MediaStorage {
  constructor(
    private readonly dir: string,
    private readonly baseUrl: string,
  ) {}
  private path(key: string): string {
    const p = resolve(this.dir, key);
    if (!p.startsWith(this.dir + sep)) throw new Error('Chave de mídia inválida');
    return p;
  }
  async put(key: string, body: Buffer): Promise<void> {
    const p = this.path(key);
    await mkdir(dirname(p), { recursive: true });
    await writeFile(p, body);
  }
  async remove(key: string): Promise<void> {
    await unlink(this.path(key)).catch(() => undefined);
  }
  url(key: string): string {
    return `${this.baseUrl}/media/${key}`;
  }
  read(key: string): Promise<Buffer> {
    return readFile(this.path(key));
  }
}

class R2Storage implements MediaStorage {
  private readonly s3: S3Client;
  constructor(private readonly cfg: Config) {
    this.s3 = new S3Client({
      region: 'auto',
      endpoint: `https://${cfg.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: cfg.R2_ACCESS_KEY_ID!, secretAccessKey: cfg.R2_SECRET_ACCESS_KEY! },
    });
  }
  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.s3.send(
      new PutObjectCommand({ Bucket: this.cfg.R2_BUCKET, Key: key, Body: body, ContentType: contentType, CacheControl: 'public, max-age=31536000, immutable' }),
    );
  }
  async remove(key: string): Promise<void> {
    await this.s3.send(new DeleteObjectCommand({ Bucket: this.cfg.R2_BUCKET, Key: key }));
  }
  url(key: string): string {
    return `${this.cfg.R2_PUBLIC_URL!.replace(/\/$/, '')}/${key}`;
  }
}

export function createStorage(cfg: Config): MediaStorage {
  if (cfg.MEDIA_DRIVER === 'r2') return new R2Storage(cfg);
  return new LocalStorage(resolve(REPO_ROOT, cfg.MEDIA_LOCAL_DIR), cfg.PUBLIC_API_URL.replace(/\/$/, ''));
}
