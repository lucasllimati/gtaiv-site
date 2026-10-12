import type {
  Availability,
  BannerSlot,
  ChannelKind,
  DiscoveryKind,
  GuideKind,
  ProductCategory,
  VerificationStatus,
} from './editorial.ts';

/**
 * Formato dos dados públicos. É o mesmo tanto nas respostas da API
 * (/api/public/*) quanto no snapshot estático (/data/*.json) gerado no build,
 * para que o site funcione com ou sem a API no ar.
 */

export interface PublicSource {
  url: string;
  title: string;
  publisher: string;
  publishedAt: string | null;
  isPrimary: boolean;
}

export interface PublicClaim {
  text: string;
  status: VerificationStatus;
  sourceUrl: string | null;
}

export interface PublicArticleSummary {
  slug: string;
  title: string;
  summary: string;
  category: { slug: string; name: string };
  verificationStatus: VerificationStatus;
  publishedAt: string;
  updatedAt: string;
  authorName: string;
  coverUrl: string | null;
  coverAlt: string | null;
  featured: boolean;
  tags: string[];
  readingMinutes: number;
  primarySource: { publisher: string; url: string } | null;
}

export interface PublicArticle extends PublicArticleSummary {
  body: string;
  sources: PublicSource[];
  claims: PublicClaim[];
  approvedAt: string | null;
  aiAssisted: boolean;
}

export interface PublicCategory {
  slug: string;
  name: string;
  description: string;
}

export interface PublicGuideEntry {
  kind: GuideKind;
  slug: string;
  title: string;
  summary: string;
  body: string;
  verificationStatus: VerificationStatus;
  eventDate: string | null;
  sources: { url: string; label: string }[];
  updatedAt: string;
}

export interface PublicDiscovery {
  slug: string;
  title: string;
  kind: DiscoveryKind;
  description: string;
  gameVersion: string | null;
  platforms: string[];
  steps: string[];
  evidence: { url: string; label: string }[];
  sourceUrl: string | null;
  verificationStatus: VerificationStatus;
  lastConfirmedAt: string | null;
  riskWarning: string | null;
  fixedInVersion: string | null;
  updatedAt: string;
}

export interface PublicProduct {
  id: number;
  name: string;
  category: ProductCategory;
  description: string | null;
  imageUrl: string | null;
  store: string;
  url: string;
  /** null quando o preço não foi verificado recentemente — a UI orienta a consultar a loja. */
  priceCents: number | null;
  currency: string;
  priceCheckedAt: string | null;
  availability: Availability;
}

export interface PublicBanner {
  id: number;
  slot: BannerSlot;
  title: string;
  subtitle: string | null;
  description: string | null;
  imageUrl: string | null;
  ctaLabel: string;
  store: string | null;
  url: string;
}

export interface PublicChannel {
  id: number;
  kind: ChannelKind;
  label: string;
  url: string;
  description: string | null;
}

export interface PublicSettings {
  siteName: string;
  tagline: string;
  contactEmail: string;
}

export interface PublicFacts {
  releaseDate: { value: string; status: VerificationStatus; sourceUrl: string } | null;
  platforms: { value: string; status: VerificationStatus; sourceUrl: string } | null;
  developer: { value: string; status: VerificationStatus; sourceUrl: string } | null;
  setting: { value: string; status: VerificationStatus; sourceUrl: string } | null;
}

export interface PublicSiteData {
  generatedAt: string;
  /** "api" quando veio do servidor ao vivo; "snapshot" quando veio do arquivo estático do build. */
  origin: 'api' | 'snapshot';
  settings: PublicSettings;
  facts: PublicFacts;
  categories: PublicCategory[];
  articles: PublicArticleSummary[];
  guide: PublicGuideEntry[];
  discoveries: PublicDiscovery[];
  products: PublicProduct[];
  banners: PublicBanner[];
  channels: PublicChannel[];
}
