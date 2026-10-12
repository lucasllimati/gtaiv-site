import { z } from 'zod';
import {
  APPROVAL_STATUSES,
  AVAILABILITY,
  BANNER_SLOTS,
  BANNER_STATUSES,
  CHANNEL_KINDS,
  DISCOVERY_KINDS,
  GUIDE_KINDS,
  PRODUCT_CATEGORIES,
  ROLES,
  SOURCE_METHODS,
  SOURCE_TYPES,
  VERIFICATION_STATUSES,
} from './editorial.ts';
import { isSafeHttpUrl } from './text.ts';

/** Esquemas de entrada da API. Toda escrita administrativa passa por eles. */

export const httpUrl = z
  .string()
  .trim()
  .max(2048)
  .refine(isSafeHttpUrl, { message: 'Informe uma URL http(s) válida.' });

export const optionalHttpUrl = z.union([httpUrl, z.literal('')]).optional().nullable()
  .transform((v) => (v ? v : null));

export const slugSchema = z
  .string()
  .trim()
  .min(2)
  .max(100)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use letras minúsculas, números e hífens.');

const isoDate = z
  .string()
  .trim()
  .refine((v) => !Number.isNaN(Date.parse(v)), { message: 'Data inválida.' });

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(1).max(200),
});

export const passwordSchema = z
  .string()
  .min(12, 'A senha precisa ter pelo menos 12 caracteres.')
  .max(200);

export const userCreateSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  name: z.string().trim().min(2).max(120),
  role: z.enum(ROLES),
  password: passwordSchema,
});

export const userUpdateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  role: z.enum(ROLES).optional(),
  active: z.boolean().optional(),
  password: passwordSchema.optional(),
});

export const articleSourceInput = z.object({
  url: httpUrl,
  title: z.string().trim().min(1).max(300),
  publisher: z.string().trim().min(1).max(120),
  publishedAt: isoDate.optional().nullable(),
  isPrimary: z.boolean().default(false),
});

export const claimInput = z.object({
  text: z.string().trim().min(3).max(600),
  status: z.enum(VERIFICATION_STATUSES),
  sourceUrl: optionalHttpUrl,
  notes: z.string().trim().max(1000).optional().nullable(),
});

export const articleInputSchema = z.object({
  title: z.string().trim().min(8).max(160),
  slug: slugSchema.optional(),
  summary: z.string().trim().min(20).max(400),
  body: z.string().trim().min(40).max(60_000),
  categorySlug: slugSchema,
  verificationStatus: z.enum(VERIFICATION_STATUSES),
  authorName: z.string().trim().min(2).max(120),
  coverAssetId: z.number().int().positive().optional().nullable(),
  coverAlt: z.string().trim().max(300).optional().nullable(),
  featured: z.boolean().default(false),
  tags: z.array(z.string().trim().min(1).max(40)).max(12).default([]),
  sources: z.array(articleSourceInput).max(30).default([]),
  claims: z.array(claimInput).max(50).default([]),
});
export type ArticleInput = z.infer<typeof articleInputSchema>;

export const articleTransitionSchema = z.object({
  to: z.enum(APPROVAL_STATUSES),
  note: z.string().trim().max(1000).optional(),
});

export const sourceInputSchema = z.object({
  name: z.string().trim().min(2).max(120),
  siteUrl: httpUrl,
  feedUrl: optionalHttpUrl,
  type: z.enum(SOURCE_TYPES),
  method: z.enum(SOURCE_METHODS),
  reliability: z.number().int().min(1).max(5),
  enabled: z.boolean(),
  keywords: z.array(z.string().trim().min(2).max(60)).max(20).default([]),
  notes: z.string().trim().max(2000).optional().nullable(),
});

export const discoveryInputSchema = z.object({
  title: z.string().trim().min(5).max(160),
  slug: slugSchema.optional(),
  kind: z.enum(DISCOVERY_KINDS),
  description: z.string().trim().min(20).max(8000),
  gameVersion: z.string().trim().max(60).optional().nullable(),
  platforms: z.array(z.string().trim().min(2).max(40)).max(6).default([]),
  steps: z.array(z.string().trim().min(2).max(500)).max(30).default([]),
  evidence: z.array(z.object({ url: httpUrl, label: z.string().trim().min(1).max(200) })).max(20).default([]),
  sourceUrl: optionalHttpUrl,
  verificationStatus: z.enum(VERIFICATION_STATUSES),
  lastConfirmedAt: isoDate.optional().nullable(),
  riskWarning: z.string().trim().max(600).optional().nullable(),
  fixedInVersion: z.string().trim().max(60).optional().nullable(),
  published: z.boolean().default(false),
});

export const guideEntryInputSchema = z.object({
  kind: z.enum(GUIDE_KINDS),
  title: z.string().trim().min(2).max(160),
  slug: slugSchema.optional(),
  summary: z.string().trim().min(10).max(500),
  body: z.string().trim().max(20_000).default(''),
  verificationStatus: z.enum(VERIFICATION_STATUSES),
  eventDate: isoDate.optional().nullable(),
  sortOrder: z.number().int().min(0).max(10_000).default(0),
  sources: z.array(z.object({ url: httpUrl, label: z.string().trim().min(1).max(200) })).max(20).default([]),
  published: z.boolean().default(false),
});

export const productInputSchema = z.object({
  name: z.string().trim().min(2).max(160),
  category: z.enum(PRODUCT_CATEGORIES),
  description: z.string().trim().max(1000).optional().nullable(),
  imageUrl: optionalHttpUrl,
  store: z.string().trim().min(2).max(80),
  affiliateUrl: httpUrl,
  affiliateProgram: z.string().trim().max(80).optional().nullable(),
  /** Preço em centavos. Só deve ser informado após verificação na loja. */
  priceCents: z.number().int().positive().max(100_000_000).optional().nullable(),
  currency: z.string().trim().length(3).default('BRL'),
  priceCheckedAt: isoDate.optional().nullable(),
  availability: z.enum(AVAILABILITY).default('unknown'),
  active: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(10_000).default(0),
});

export const bannerInputSchema = z
  .object({
    slot: z.enum(BANNER_SLOTS),
    title: z.string().trim().min(3).max(120),
    subtitle: z.string().trim().max(160).optional().nullable(),
    description: z.string().trim().max(400).optional().nullable(),
    imageUrl: optionalHttpUrl,
    ctaLabel: z.string().trim().min(2).max(40),
    productId: z.number().int().positive().optional().nullable(),
    store: z.string().trim().max(80).optional().nullable(),
    targetUrl: httpUrl,
    priority: z.number().int().min(0).max(1000).default(0),
    startsAt: isoDate.optional().nullable(),
    endsAt: isoDate.optional().nullable(),
    status: z.enum(BANNER_STATUSES),
  })
  .refine((b) => !b.startsAt || !b.endsAt || Date.parse(b.startsAt) < Date.parse(b.endsAt), {
    message: 'O fim da exibição precisa ser posterior ao início.',
    path: ['endsAt'],
  });

export const channelInputSchema = z.object({
  kind: z.enum(CHANNEL_KINDS),
  label: z.string().trim().min(2).max(80),
  url: httpUrl.refine(
    (u) => /^(https:\/\/)(t\.me|telegram\.me|chat\.whatsapp\.com|whatsapp\.com|www\.whatsapp\.com|wa\.me)\//.test(u),
    { message: 'Use um link oficial de convite do Telegram (t.me) ou WhatsApp (chat.whatsapp.com, whatsapp.com/channel, wa.me).' },
  ),
  description: z.string().trim().max(200).optional().nullable(),
  active: z.boolean(),
});

export const clickEventSchema = z.object({
  targetType: z.enum(['banner', 'product', 'channel']),
  targetId: z.number().int().positive(),
  placement: z.string().trim().max(60).regex(/^[a-z0-9_:-]+$/i),
});

export const pageViewSchema = z.object({
  path: z.string().trim().max(200).regex(/^\/[^\s]*$/),
});

export const settingsSchema = z.object({
  siteName: z.string().trim().min(2).max(60),
  tagline: z.string().trim().max(160),
  contactEmail: z.union([z.string().trim().email(), z.literal('')]),
});

export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().max(120).optional(),
  status: z.string().trim().max(40).optional(),
});
