import type { SourceType, VerificationStatus } from '@pgi/shared';

/** Assuntos detectados por palavras-chave (pt/en). Um item pode ter vários. */
const TOPICS: Record<string, RegExp> = {
  lancamento: /\b(release date|launch|lançamento|data de lan[çc]amento|delay|delayed|adiad|adiamento|pre-?order|pr[ée]-?venda)\b/i,
  trailer: /\b(trailer|teaser|screenshots?|capturas?)\b/i,
  personagens: /\b(jason|lucia|character|personage)/i,
  mapa: /\b(map|mapa|vice city|leonida|keys|grassrivers|port gellhorn|ambrosia|kalaga)\b/i,
  plataformas: /\b(ps5|playstation|xbox|series x|pc version|vers[ãa]o (para|de) pc|steam)\b/i,
  online: /\b(gta online|online mode|multiplayer|modo online)\b/i,
  preco: /\b(price|pre[çc]o|\$\d+|r\$|edition|edi[çc][ãa]o)\b/i,
  negocios: /\b(take-?two|earnings|investor|resultados financeiros|strauss zelnick|revenue)\b/i,
  vazamento: /\b(leak|leaked|vazamento|vazad|insider|datamine)\b/i,
};

/** Indícios de que a afirmação não está confirmada. */
const UNCONFIRMED: [string, RegExp][] = [
  ['rumor', /\b(rumou?r|boato|rumores)\b/i],
  ['vazamento', /\b(leak|leaked|vazamento|vazad)\b/i],
  ['insider', /\b(insider|according to (a )?source|sources say|segundo fontes|fontes afirmam|reportedly|supostamente|allegedly)\b/i],
  ['especulacao', /\b(could|might|may be|possibly|speculat|theor(y|ies)|teoria|pode ser|poderia|talvez)\b/i],
  ['nao-oficial', /\b(unconfirmed|n[ãa]o confirmad|not (yet )?confirmed)\b/i],
  ['desmentido', /\b(debunk|denied|fake|falso|desmentid|hoax)\b/i],
];

export interface Classification {
  topics: string[];
  flags: string[];
  suggestedStatus: VerificationStatus;
}

export function classify(text: string, sourceType: SourceType): Classification {
  const topics = Object.entries(TOPICS)
    .filter(([, re]) => re.test(text))
    .map(([k]) => k);
  const flags = UNCONFIRMED.filter(([, re]) => re.test(text)).map(([k]) => k);

  let suggestedStatus: VerificationStatus;
  if (flags.includes('desmentido')) suggestedStatus = 'in_review';
  else if (sourceType === 'official') suggestedStatus = 'confirmed';
  else if (flags.includes('rumor') || flags.includes('vazamento') || flags.includes('insider')) suggestedStatus = 'rumor';
  else if (flags.includes('especulacao')) suggestedStatus = 'theory';
  else if (sourceType === 'community') suggestedStatus = 'rumor';
  else suggestedStatus = 'reported';

  return { topics, flags, suggestedStatus };
}

/** Um item de feed genérico só entra se mencionar algum termo exigido pela fonte. */
export function matchesKeywords(text: string, keywords: string[]): boolean {
  if (keywords.length === 0) return true;
  const hay = text.toLowerCase();
  return keywords.some((k) => {
    const kw = k.toLowerCase();
    // Termos curtos como "gta 6" precisam de limite de palavra para não casar "gta 60".
    const re = new RegExp(`(^|[^a-z0-9])${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^a-z0-9])`, 'i');
    return re.test(hay);
  });
}
