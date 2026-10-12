import { Link } from 'react-router';
import { ArrowRight, Clock, ExternalLink as ExtIcon, Gamepad2, Send, ShoppingCart } from 'lucide-react';
import {
  AVAILABILITY_LABELS,
  type PublicArticleSummary,
  type PublicBanner,
  type PublicChannel,
  type PublicProduct,
} from '@pgi/shared';
import { outboundHref } from '../lib/data.ts';
import { formatDate, formatDateTime, formatMoney } from '../lib/format.ts';
import { ConsoleArt, GameGearArt, NeonScene } from './Art.tsx';
import { StatusBadge } from './ui.tsx';

export function ArticleCard({ article, headingLevel = 3 }: { article: PublicArticleSummary; headingLevel?: 2 | 3 }) {
  const H = `h${headingLevel}` as const;
  return (
    <article className="card">
      <div className="card__media">
        {article.coverUrl ? (
          <img src={article.coverUrl} alt={article.coverAlt ?? ''} loading="lazy" decoding="async" />
        ) : (
          <NeonScene seed={article.slug} />
        )}
        <span className="badge badge--category">{article.category.name}</span>
      </div>
      <div className="card__body">
        <div className="card__meta">
          <StatusBadge status={article.verificationStatus} />
          <time dateTime={article.publishedAt}>{formatDate(article.publishedAt)}</time>
        </div>
        <H className="card__title">
          <Link to={`/noticias/${article.slug}`}>{article.title}</Link>
        </H>
        <p className="card__summary">{article.summary}</p>
        <div className="card__foot">
          <span>{article.primarySource ? `Fonte: ${article.primarySource.publisher}` : 'Fonte: redação'}</span>
          <span className="row" style={{ gap: 4 }}>
            <Clock size={13} aria-hidden="true" /> {article.readingMinutes} min
          </span>
        </div>
      </div>
    </article>
  );
}

const FALLBACK_BANNERS: Record<PublicBanner['slot'], { kicker: string; title: string; text: string; cta: string }> = {
  home_primary: {
    kicker: 'Prepare seu setup',
    title: 'Consoles para jogar GTA VI',
    text: 'Em breve, ofertas verificadas de consoles compatíveis, sempre com preço conferido e data da verificação.',
    cta: 'Ver a vitrine',
  },
  home_secondary: {
    kicker: 'Jogos e acessórios',
    title: 'GTA VI, controles e acessórios',
    text: 'Reserva, controles e acessórios compatíveis: só mostramos preço quando ele foi conferido na loja.',
    cta: 'Ver produtos',
  },
};

/**
 * Banner afiliado configurado no painel. Sem campanha ativa, exibe um espaço
 * reservado que leva à vitrine interna — nunca um link ou preço inventado.
 */
export function PromoBanner({ slot, banner }: { slot: PublicBanner['slot']; banner?: PublicBanner }) {
  const cls = `promo ${slot === 'home_primary' ? 'promo--primary' : 'promo--secondary'}`;
  const Art = slot === 'home_primary' ? ConsoleArt : GameGearArt;
  if (!banner) {
    const f = FALLBACK_BANNERS[slot];
    return (
      <section className={cls} aria-label={f.title}>
        <div className="promo__body">
          <div className="promo__kicker">{f.kicker}</div>
          <h3>{f.title}</h3>
          <p>{f.text}</p>
          <Link className={slot === 'home_primary' ? 'btn btn--cyan' : 'btn btn--primary'} to="/ofertas">
            {f.cta} <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
        <div className="promo__art">
          <Art />
        </div>
      </section>
    );
  }
  return (
    <section className={cls} aria-label={banner.title}>
      <span className="promo__ad badge badge--ad">Publicidade</span>
      <div className="promo__body">
        {banner.subtitle && <div className="promo__kicker">{banner.subtitle}</div>}
        <h3>{banner.title}</h3>
        {banner.description && <p>{banner.description}</p>}
        <a
          className={slot === 'home_primary' ? 'btn btn--cyan' : 'btn btn--primary'}
          href={outboundHref('banner', banner.id, banner.url, slot)}
          target="_blank"
          rel="sponsored noopener noreferrer"
        >
          {banner.ctaLabel} <ExtIcon size={16} aria-hidden="true" />
        </a>
        <div className="promo__store">
          {banner.store ? `Na ${banner.store} · ` : ''}Link afiliado
        </div>
      </div>
      <div className="promo__art">{banner.imageUrl ? <img src={banner.imageUrl} alt="" loading="lazy" /> : <Art />}</div>
    </section>
  );
}

export function ProductCard({ product, placement }: { product: PublicProduct; placement: string }) {
  return (
    <article className="product">
      <div className="product__img">
        {product.imageUrl ? <img src={product.imageUrl} alt="" loading="lazy" /> : <Gamepad2 size={34} aria-hidden="true" color="#8e9cbd" />}
      </div>
      <div>
        <h3 className="product__name">{product.name}</h3>
        <div className="product__store">
          {product.store} · {AVAILABILITY_LABELS[product.availability]}
        </div>
        {product.priceCents != null && product.priceCheckedAt ? (
          <>
            <div className="product__price">{formatMoney(product.priceCents, product.currency)}</div>
            <div className="product__checked">Preço verificado em {formatDateTime(product.priceCheckedAt)}. Pode mudar a qualquer momento.</div>
          </>
        ) : (
          <div className="product__noprice">Consulte o preço atualizado na loja.</div>
        )}
        <div className="product__actions">
          <a className="btn btn--primary btn--sm" href={outboundHref('product', product.id, product.url, placement)} target="_blank" rel="sponsored noopener noreferrer">
            <ShoppingCart size={15} aria-hidden="true" /> Ver na {product.store}
          </a>
          <span className="badge badge--ad">Afiliado</span>
        </div>
      </div>
    </article>
  );
}

function WhatsappIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 11.9 11.9 0 0 0 4.6 4c1.7.7 2.3.8 3.2.7a2.7 2.7 0 0 0 1.8-1.3 2.2 2.2 0 0 0 .2-1.3c-.1-.1-.2-.2-.5-.3Z" />
    </svg>
  );
}

/** Chamada para Telegram/WhatsApp. Só exibe botões para canais realmente configurados. */
export function ChannelsCta({ channels, compact, placement, title, text }: { channels: PublicChannel[]; compact?: boolean; placement: string; title?: string; text?: string }) {
  if (channels.length === 0) return null;
  return (
    <section className={`channels-cta ${compact ? 'channels-cta--compact' : ''}`} aria-label="Canais do portal">
      <div>
        <div className="eyebrow">Fique por dentro</div>
        <h2>{title ?? 'Receba as atualizações de GTA VI'}</h2>
        <p>{text ?? 'Notícias verificadas, rumores identificados e ofertas conferidas, direto no seu Telegram ou WhatsApp.'}</p>
      </div>
      <div className="channels-cta__actions">
        {channels.map((c) => (
          <a
            key={c.id}
            className={`btn ${c.kind === 'telegram' ? 'btn--telegram' : 'btn--whatsapp'}`}
            href={outboundHref('channel', c.id, c.url, placement)}
            target="_blank"
            rel="noopener noreferrer"
          >
            {c.kind === 'telegram' ? <Send size={18} aria-hidden="true" /> : <WhatsappIcon />}
            {c.label}
          </a>
        ))}
      </div>
    </section>
  );
}
