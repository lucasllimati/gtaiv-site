/**
 * Vocabulário editorial do portal. Mantido em um só lugar para que API,
 * pipeline e frontend usem exatamente os mesmos valores e rótulos.
 */

export const VERIFICATION_STATUSES = [
  'confirmed',
  'reported',
  'rumor',
  'theory',
  'debunked',
  'outdated',
  'in_review',
] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export const VERIFICATION_LABELS: Record<VerificationStatus, string> = {
  confirmed: 'Confirmado',
  reported: 'Reportado',
  rumor: 'Rumor',
  theory: 'Teoria',
  debunked: 'Desmentido',
  outdated: 'Desatualizado',
  in_review: 'Em revisão',
};

export const VERIFICATION_DESCRIPTIONS: Record<VerificationStatus, string> = {
  confirmed: 'Sustentado por anúncio oficial ou evidência primária clara.',
  reported: 'Publicado por fonte identificada, ainda sem confirmação oficial.',
  rumor: 'Alegação sem comprovação suficiente.',
  theory: 'Interpretação ou especulação editorial.',
  debunked: 'Contradito por evidências confiáveis.',
  outdated: 'Substituído por uma atualização posterior.',
  in_review: 'A redação ainda está verificando esta informação.',
};

/** Status que exigem aviso explícito de especulação ao leitor. */
export const SPECULATIVE_STATUSES: ReadonlySet<VerificationStatus> = new Set([
  'rumor',
  'theory',
  'in_review',
]);

export const APPROVAL_STATUSES = [
  'draft',
  'in_review',
  'approved',
  'published',
  'rejected',
  'archived',
] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

export const APPROVAL_LABELS: Record<ApprovalStatus, string> = {
  draft: 'Rascunho',
  in_review: 'Aguardando revisão',
  approved: 'Aprovado',
  published: 'Publicado',
  rejected: 'Rejeitado',
  archived: 'Arquivado',
};

/** Transições de aprovação permitidas. A publicação exige aprovação humana prévia. */
export const APPROVAL_TRANSITIONS: Record<ApprovalStatus, readonly ApprovalStatus[]> = {
  draft: ['in_review', 'archived'],
  in_review: ['approved', 'rejected', 'draft'],
  approved: ['published', 'draft', 'archived'],
  published: ['archived', 'draft'],
  rejected: ['draft', 'archived'],
  archived: ['draft'],
};

export function canTransition(from: ApprovalStatus, to: ApprovalStatus): boolean {
  return APPROVAL_TRANSITIONS[from].includes(to);
}

export const ROLES = ['admin', 'editor', 'viewer'] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Administrador',
  editor: 'Editor',
  viewer: 'Leitor (somente consulta)',
};

/** Permissões por papel. Validadas no backend; o frontend apenas reflete. */
export const PERMISSIONS = {
  'articles:read': ['admin', 'editor', 'viewer'],
  'articles:write': ['admin', 'editor'],
  'articles:approve': ['admin', 'editor'],
  'articles:publish': ['admin'],
  'sources:write': ['admin'],
  'pipeline:run': ['admin', 'editor'],
  'commerce:write': ['admin'],
  'channels:write': ['admin'],
  'media:write': ['admin', 'editor'],
  'users:manage': ['admin'],
  'audit:read': ['admin'],
  'metrics:read': ['admin', 'editor', 'viewer'],
} as const satisfies Record<string, readonly Role[]>;
export type Permission = keyof typeof PERMISSIONS;

export function hasPermission(role: Role, permission: Permission): boolean {
  return (PERMISSIONS[permission] as readonly Role[]).includes(role);
}

export const SOURCE_TYPES = ['official', 'press', 'community'] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];
export const SOURCE_TYPE_LABELS: Record<SourceType, string> = {
  official: 'Oficial',
  press: 'Imprensa especializada',
  community: 'Comunidade',
};

export const SOURCE_METHODS = ['rss', 'api', 'page', 'manual'] as const;
export type SourceMethod = (typeof SOURCE_METHODS)[number];
export const SOURCE_METHOD_LABELS: Record<SourceMethod, string> = {
  rss: 'Feed RSS/Atom',
  api: 'API autorizada',
  page: 'Página pública',
  manual: 'Acompanhamento manual',
};

export const SOURCE_ITEM_STATUSES = ['new', 'drafted', 'ignored', 'duplicate'] as const;
export type SourceItemStatus = (typeof SOURCE_ITEM_STATUSES)[number];

export const DISCOVERY_KINDS = ['glitch', 'bug', 'secret', 'easter_egg', 'mystery'] as const;
export type DiscoveryKind = (typeof DISCOVERY_KINDS)[number];
export const DISCOVERY_KIND_LABELS: Record<DiscoveryKind, string> = {
  glitch: 'Glitch',
  bug: 'Bug',
  secret: 'Segredo',
  easter_egg: 'Easter egg',
  mystery: 'Mistério',
};

export const GUIDE_KINDS = [
  'history',
  'character',
  'location',
  'vehicle',
  'activity',
  'faq',
] as const;
export type GuideKind = (typeof GUIDE_KINDS)[number];
export const GUIDE_KIND_LABELS: Record<GuideKind, string> = {
  history: 'História e cronologia',
  character: 'Personagens',
  location: 'Mapa e locais',
  vehicle: 'Veículos',
  activity: 'Atividades',
  faq: 'Perguntas frequentes',
};

export const BANNER_SLOTS = ['home_primary', 'home_secondary'] as const;
export type BannerSlot = (typeof BANNER_SLOTS)[number];
export const BANNER_SLOT_LABELS: Record<BannerSlot, string> = {
  home_primary: 'Banner 1 — Consoles (PS5 / PS5 Pro)',
  home_secondary: 'Banner 2 — GTA VI, DualSense e acessórios',
};

export const BANNER_STATUSES = ['draft', 'active', 'paused'] as const;
export type BannerStatus = (typeof BANNER_STATUSES)[number];

export const CHANNEL_KINDS = ['telegram', 'whatsapp'] as const;
export type ChannelKind = (typeof CHANNEL_KINDS)[number];

export const PRODUCT_CATEGORIES = ['console', 'game', 'controller', 'accessory', 'collectible'] as const;
export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];
export const PRODUCT_CATEGORY_LABELS: Record<ProductCategory, string> = {
  console: 'Consoles',
  game: 'Jogos',
  controller: 'Controles',
  accessory: 'Acessórios',
  collectible: 'Colecionáveis e livros',
};

export const AVAILABILITY = ['in_stock', 'out_of_stock', 'preorder', 'unknown'] as const;
export type Availability = (typeof AVAILABILITY)[number];
export const AVAILABILITY_LABELS: Record<Availability, string> = {
  in_stock: 'Disponível',
  out_of_stock: 'Indisponível',
  preorder: 'Pré-venda',
  unknown: 'Consultar na loja',
};

/** Depois deste prazo um preço deixa de ser exibido e o leitor é orientado a consultar a loja. */
export const PRICE_MAX_AGE_HOURS = 24;

export function isPriceFresh(checkedAt: string | null | undefined, now = new Date()): boolean {
  if (!checkedAt) return false;
  const t = Date.parse(checkedAt);
  if (Number.isNaN(t)) return false;
  return now.getTime() - t <= PRICE_MAX_AGE_HOURS * 3_600_000;
}
