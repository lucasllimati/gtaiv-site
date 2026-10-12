import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import { and, eq, gte, sql } from 'drizzle-orm';
import { auditLogs, type Db } from '@pgi/db';
import {
  SPECULATIVE_STATUSES,
  VERIFICATION_LABELS,
  VERIFICATION_STATUSES,
  truncate,
  type VerificationStatus,
} from '@pgi/shared';
import type { Config } from '../config.ts';

/**
 * Geração assistida por IA. Sempre produz RASCUNHOS: nada aqui publica conteúdo.
 * Sem ANTHROPIC_API_KEY (ou acima do limite diário), cai para um modelo
 * determinístico que estrutura o material e pede reescrita humana.
 */

const claimOut = z.object({
  text: z.string(),
  status: z.enum(VERIFICATION_STATUSES),
  sourceUrl: z.string().nullable(),
});

export const draftSchema = z.object({
  title: z.string(),
  summary: z.string(),
  body: z.string(),
  verificationStatus: z.enum(VERIFICATION_STATUSES),
  tags: z.array(z.string()),
  claims: z.array(claimOut),
  reviewerNotes: z.string(),
});
export type ArticleDraft = z.infer<typeof draftSchema> & { generator: 'ai' | 'template' };

const sceneSchema = z.object({ caption: z.string(), visual: z.string(), seconds: z.number() });
const scriptSchema = z.object({ hook: z.string(), narration: z.string(), scenes: z.array(sceneSchema) });

export const contentPackageSchema = z.object({
  titles: z.array(z.string()),
  socialSummary: z.string(),
  hook: z.string(),
  scripts: z.object({ s15: scriptSchema, s30: scriptSchema, s60: scriptSchema }),
  coverSuggestion: z.object({ headline: z.string(), kicker: z.string(), visualIdea: z.string() }),
  captions: z.object({ instagram: z.string(), tiktok: z.string(), youtube: z.string() }),
  channelCta: z.string(),
});
export type ContentPackage = z.infer<typeof contentPackageSchema> & {
  generator: 'ai' | 'template';
  references: { label: string; url: string }[];
  verificationStatus: VerificationStatus;
  speculativeNotice: string | null;
};

const EDITORIAL_RULES = `Você é redator de um portal independente brasileiro sobre GTA VI. Escreva em português do Brasil.
Regras inegociáveis:
- Escreva texto original com contexto e explicação; nunca copie frases da fonte nem apenas troque palavras por sinônimos.
- Use apenas fatos presentes no material fornecido. Não invente datas, citações, números, nomes, fontes, missões, mecânicas ou glitches.
- Diferencie fato, interpretação e especulação. Se a fonte não é oficial, a afirmação é no máximo "reported"; boatos são "rumor"; leituras editoriais são "theory".
- Só use "confirmed" quando o material vier de fonte oficial (Rockstar/Take-Two) ou evidência primária clara.
- Toda afirmação relevante deve aparecer em "claims" com a URL da fonte que a sustenta.
- Não sugira afiliação com Rockstar, Sony, Microsoft ou Amazon.`;

export class AiService {
  private readonly client: Anthropic | null;
  constructor(
    private readonly cfg: Config,
    private readonly db: Db,
  ) {
    this.client = cfg.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: cfg.ANTHROPIC_API_KEY }) : null;
  }

  get enabled(): boolean {
    return this.client !== null && this.cfg.AI_DAILY_LIMIT > 0;
  }

  /** Conta chamadas de IA do dia (registradas no histórico) para respeitar AI_DAILY_LIMIT. */
  async usedToday(): Promise<number> {
    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    const [row] = await this.db
      .select({ n: sql<number>`count(*)` })
      .from(auditLogs)
      .where(and(eq(auditLogs.action, 'ai.call'), gte(auditLogs.createdAt, start.toISOString())));
    return Number(row?.n ?? 0);
  }

  private async canCall(): Promise<boolean> {
    if (!this.client) return false;
    return (await this.usedToday()) < this.cfg.AI_DAILY_LIMIT;
  }

  private async record(kind: string, ok: boolean, detail: string): Promise<void> {
    await this.db.insert(auditLogs).values({ action: 'ai.call', entity: kind, details: { ok, detail, model: this.cfg.ANTHROPIC_MODEL } });
  }

  private async callStructured<S extends z.ZodType>(kind: string, schema: S, prompt: string): Promise<z.infer<S> | null> {
    if (!(await this.canCall())) return null;
    try {
      const response = await this.client!.messages.parse({
        model: this.cfg.ANTHROPIC_MODEL,
        max_tokens: 16000,
        output_config: { effort: 'medium', format: zodOutputFormat(schema) },
        system: EDITORIAL_RULES,
        messages: [{ role: 'user', content: prompt }],
      });
      if (response.stop_reason === 'refusal' || !response.parsed_output) {
        await this.record(kind, false, `stop_reason=${response.stop_reason}`);
        return null;
      }
      await this.record(kind, true, `in=${response.usage.input_tokens} out=${response.usage.output_tokens}`);
      return response.parsed_output as z.infer<S>;
    } catch (err) {
      const msg =
        err instanceof Anthropic.RateLimitError
          ? 'limite de taxa da API'
          : err instanceof Anthropic.AuthenticationError
            ? 'chave da API inválida'
            : err instanceof Anthropic.APIError
              ? `erro ${err.status}`
              : 'falha de conexão';
      await this.record(kind, false, msg);
      return null;
    }
  }

  async draftFromSourceItem(input: {
    title: string;
    excerpt: string | null;
    url: string;
    sourceName: string;
    sourceType: 'official' | 'press' | 'community';
    publishedAt: string | null;
    suggestedStatus: VerificationStatus;
  }): Promise<ArticleDraft> {
    const prompt = `Prepare um rascunho de notícia a partir do item abaixo, coletado de um feed.
O material disponível é somente o título e o resumo do feed. Não acrescente fatos que não estejam nele.
Se o material for insuficiente, diga isso em "reviewerNotes" e mantenha o texto curto.
Corpo em Markdown simples (títulos ##, listas, negrito), sem HTML. Inclua uma seção "## O que ainda não se sabe".

Fonte: ${input.sourceName} (${input.sourceType === 'official' ? 'oficial' : input.sourceType === 'press' ? 'imprensa' : 'comunidade'})
URL: ${input.url}
Publicado em: ${input.publishedAt ?? 'desconhecido'}
Título original: ${input.title}
Resumo do feed: ${input.excerpt ?? '(sem resumo)'}
Status sugerido pela classificação automática: ${input.suggestedStatus}`;
    const ai = await this.callStructured('draft', draftSchema, prompt);
    if (ai) return { ...ai, generator: 'ai' };
    return templateDraft(input);
  }

  async contentPackage(article: {
    title: string;
    summary: string;
    body: string;
    verificationStatus: VerificationStatus;
    sources: { title: string; publisher: string; url: string }[];
    channelNames: string[];
  }): Promise<ContentPackage> {
    const references = article.sources.map((s) => ({ label: `${s.publisher} — ${s.title}`, url: s.url }));
    const speculative = SPECULATIVE_STATUSES.has(article.verificationStatus);
    const speculativeNotice = speculative
      ? `Conteúdo ${VERIFICATION_LABELS[article.verificationStatus].toLowerCase()}: não é informação confirmada.`
      : null;
    const prompt = `Crie um pacote de conteúdo para redes sociais a partir do artigo aprovado abaixo.
- 3 títulos diferentes (máx. 70 caracteres cada).
- Resumo curto para redes sociais (até 280 caracteres).
- Gancho inicial forte, sem sensacionalismo enganoso.
- Roteiros de 15, 30 e 60 segundos para vídeo vertical, com narração e cenas (legenda curta na tela, descrição do visual ORIGINAL a ser criado, duração em segundos). As durações das cenas devem somar o total do roteiro.
- Os visuais devem ser artes/gráficos originais: não proponha usar trailers, capturas de terceiros ou "gameplay" fictício.
- Sugestão de capa (manchete curta, chamada, ideia visual).
- Legendas para Instagram, TikTok e YouTube, com hashtags pertinentes.
- Chamada para os canais: ${article.channelNames.length ? article.channelNames.join(' e ') : 'Telegram e WhatsApp do portal'}.
${speculative ? `- O conteúdo é ${VERIFICATION_LABELS[article.verificationStatus]}: deixe isso explícito no gancho, na narração e nas legendas.` : ''}

Status de verificação: ${VERIFICATION_LABELS[article.verificationStatus]}
Título: ${article.title}
Resumo: ${article.summary}
Corpo:
${article.body}`;
    const ai = await this.callStructured('content_package', contentPackageSchema, prompt);
    const base = ai ?? templatePackage(article, speculativeNotice);
    return { ...base, generator: ai ? 'ai' : 'template', references, verificationStatus: article.verificationStatus, speculativeNotice };
  }
}

/** Rascunho sem IA: estrutura o material e deixa claro que precisa ser reescrito. */
export function templateDraft(input: {
  title: string;
  excerpt: string | null;
  url: string;
  sourceName: string;
  suggestedStatus: VerificationStatus;
}): ArticleDraft {
  const excerpt = input.excerpt?.trim() || 'O feed não forneceu resumo.';
  return {
    title: truncate(input.title, 150),
    summary: truncate(`${input.sourceName} publicou: ${input.title}. Rascunho aguardando apuração e reescrita.`, 380),
    body: `> **Rascunho automático sem IA.** Reescreva com texto original antes de enviar para revisão. Não publique este conteúdo como está.

## O que foi publicado

Segundo **${input.sourceName}**, ${excerpt}

## Contexto

_Explique ao leitor por que isso importa e como se relaciona com o que já foi confirmado oficialmente._

## O que ainda não se sabe

_Liste os pontos sem confirmação._

Fonte original: [${input.sourceName}](${input.url})`,
    verificationStatus: input.suggestedStatus,
    tags: [],
    claims: [{ text: input.title, status: input.suggestedStatus, sourceUrl: input.url }],
    reviewerNotes: 'Gerado sem IA (chave ausente, limite diário atingido ou falha na chamada). Requer reescrita completa.',
    generator: 'template',
  };
}

function scenesFor(total: number, lines: string[]): { caption: string; visual: string; seconds: number }[] {
  const n = Math.max(1, lines.length);
  const each = Math.floor(total / n);
  return lines.map((line, i) => ({
    caption: truncate(line, 90),
    visual:
      i === 0
        ? 'Arte original com a manchete em destaque sobre fundo neon do portal.'
        : i === n - 1
          ? 'Tela final com logo do portal e chamada para os canais.'
          : 'Cartela de texto com ícone do tema e selo de verificação.',
    seconds: i === n - 1 ? total - each * (n - 1) : each,
  }));
}

export function templatePackage(
  a: { title: string; summary: string; verificationStatus: VerificationStatus; channelNames: string[] },
  speculativeNotice: string | null,
): z.infer<typeof contentPackageSchema> {
  const label = VERIFICATION_LABELS[a.verificationStatus];
  const hook = speculativeNotice ? `${label}: ${truncate(a.title, 80)}` : truncate(a.title, 90);
  const cta = a.channelNames.length
    ? `Receba as atualizações de GTA VI no nosso ${a.channelNames.join(' e no ')}.`
    : 'Siga o portal para receber as próximas atualizações de GTA VI.';
  const sentences = a.summary.split(/(?<=[.!?])\s+/).filter(Boolean);
  const mk = (total: number, extra: string[]) => {
    const lines = [hook, ...extra, cta];
    return { hook, narration: lines.join(' '), scenes: scenesFor(total, lines) };
  };
  return {
    titles: [truncate(a.title, 70), truncate(`GTA VI: ${sentences[0] ?? a.title}`, 70), truncate(`${label} — ${a.title}`, 70)],
    socialSummary: truncate(`${speculativeNotice ? `[${label}] ` : ''}${a.summary}`, 280),
    hook,
    scripts: {
      s15: mk(15, sentences.slice(0, 1)),
      s30: mk(30, sentences.slice(0, 2)),
      s60: mk(60, [...sentences.slice(0, 3), 'Fonte e detalhes completos no portal.']),
    },
    coverSuggestion: { headline: truncate(a.title, 60), kicker: label.toUpperCase(), visualIdea: 'Fundo neon do portal, manchete em destaque e selo de verificação.' },
    captions: {
      instagram: `${a.summary}\n\n${speculativeNotice ?? ''}\n${cta}\n\n#GTA6 #GTAVI #ViceCity`.replace(/\n{3,}/g, '\n\n'),
      tiktok: truncate(`${hook} ${cta} #GTA6 #GTAVI`, 150),
      youtube: `${a.title}\n\n${a.summary}\n\n${speculativeNotice ?? ''}\n${cta}`.replace(/\n{3,}/g, '\n\n'),
    },
    channelCta: cta,
  };
}
