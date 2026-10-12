import { z } from 'zod';

/**
 * Configuração lida exclusivamente de variáveis de ambiente.
 * Segredos (DATABASE_AUTH_TOKEN, ANTHROPIC_API_KEY, R2_*) nunca vão para o frontend.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().default(8787),
  /** Origens autorizadas a chamar a API com CORS (lista separada por vírgula). */
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  /** URL pública da API (usada para montar links de mídia e redirecionamentos). */
  PUBLIC_API_URL: z.string().default('http://localhost:8787'),
  DATABASE_URL: z.string().optional(),
  DATABASE_AUTH_TOKEN: z.string().optional(),
  SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(24 * 30).default(12),
  /** Força cookie "Secure". Ativado automaticamente em produção. */
  COOKIE_SECURE: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  /** Diretório com o build do frontend. Quando existe, a API serve o site e o painel na mesma origem. */
  WEB_DIST_DIR: z.string().optional(),
  MEDIA_DRIVER: z.enum(['local', 'r2']).default('local'),
  MEDIA_LOCAL_DIR: z.string().default('.local/media'),
  MEDIA_MAX_MB: z.coerce.number().min(1).max(200).default(25),
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET: z.string().optional(),
  R2_PUBLIC_URL: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default('claude-opus-5-5'),
  /** Limite diário de chamadas de IA, para evitar custos inesperados. */
  AI_DAILY_LIMIT: z.coerce.number().int().min(0).default(50),
  /** Token do GitHub para disparar a republicação do site estático após publicar conteúdo (opcional). */
  GITHUB_DISPATCH_TOKEN: z.string().optional(),
  GITHUB_REPOSITORY: z.string().optional(),
  CLICK_RETENTION_DAYS: z.coerce.number().int().min(7).max(730).default(180),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
});

export type Config = z.infer<typeof envSchema> & { cookieSecure: boolean; corsOrigins: string[] };

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Configuração inválida: ${issues}`);
  }
  const c = parsed.data;
  if (c.MEDIA_DRIVER === 'r2') {
    for (const k of ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET', 'R2_PUBLIC_URL'] as const) {
      if (!c[k]) throw new Error(`MEDIA_DRIVER=r2 exige ${k}`);
    }
  }
  return {
    ...c,
    cookieSecure: c.COOKIE_SECURE ?? c.NODE_ENV === 'production',
    corsOrigins: c.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean),
  };
}
