import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Compass, Mail } from 'lucide-react';
import { VERIFICATION_DESCRIPTIONS, VERIFICATION_STATUSES } from '@pgi/shared';
import { StatusBadge } from '../components/ui.tsx';
import { useSite } from '../lib/data.ts';
import { useSeo } from '../lib/seo.ts';

const REPO_URL = 'https://github.com/lucasllimati/gtaiv-site';

function StaticPage({ title, description, path, children }: { title: string; description: string; path: string; children: (siteName: string, contactEmail: string) => ReactNode }) {
  const site = useSite();
  const siteName = site.data?.settings.siteName ?? 'Project GTA IV';
  useSeo({ title, description, path, siteName });
  return (
    <div className="container">
      <article className="article" style={{ marginInline: 'auto' }}>
        <header className="page-hero">
          <h1>{title}</h1>
        </header>
        <div className="prose">{children(siteName, site.data?.settings.contactEmail ?? '')}</div>
      </article>
    </div>
  );
}

export function AboutPage() {
  return (
    <StaticPage title="Sobre o projeto" description="Quem somos, como trabalhamos e como verificamos as informações sobre GTA VI." path="/sobre">
      {(name) => (
        <>
          <p>
            <strong>{name}</strong> é um portal editorial <strong>independente</strong> sobre Grand Theft Auto VI. Não temos qualquer vínculo com a
            Rockstar Games, a Take-Two Interactive, a Sony, a Microsoft ou a Amazon. Nossa identidade visual é própria e as ilustrações do site são
            originais.
          </p>
          <h2>O que fazemos</h2>
          <ul>
            <li>Acompanhamos fontes oficiais e veículos especializados por feeds públicos, respeitando os termos de uso de cada fonte e o robots.txt.</li>
            <li>Escrevemos textos originais, com contexto e explicação. Não copiamos reportagens de terceiros.</li>
            <li>Mantemos um guia do universo do jogo que separa fatos revelados de teorias.</li>
            <li>Registramos glitches e descobertas apenas quando há evidência verificável.</li>
          </ul>
          <h2 id="verificacao">Critérios de verificação</h2>
          <p>Todo conteúdo recebe um destes status, exibido junto ao título:</p>
          <ul className="list-plain" style={{ display: 'grid', gap: 10 }}>
            {VERIFICATION_STATUSES.map((s) => (
              <li key={s} className="row" style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}>
                <span style={{ minWidth: 130 }}>
                  <StatusBadge status={s} withTitle={false} />
                </span>
                <span>{VERIFICATION_DESCRIPTIONS[s]}</span>
              </li>
            ))}
          </ul>
          <p>
            Rumores nunca são apresentados como fatos. Quando uma informação muda, o texto é atualizado e marcado como <em>Desatualizado</em> ou{' '}
            <em>Desmentido</em>, com link para a informação nova. Não publicamos material confidencial vazado nem dados pessoais.
          </p>
          <h2>Uso de inteligência artificial</h2>
          <p>
            Usamos ferramentas de IA para organizar fontes, sugerir rascunhos e preparar roteiros para redes sociais. <strong>Nenhum texto é publicado
            sem revisão e aprovação humana</strong>, e cada afirmação relevante fica ligada à sua fonte. Textos produzidos com apoio de IA são
            identificados no rodapé do artigo.
          </p>
          <h2>Correções</h2>
          <p>
            Encontrou um erro? <Link to="/contato">Fale com a redação</Link>. Corrigimos e registramos a data da atualização.
          </p>
        </>
      )}
    </StaticPage>
  );
}

export function ContactPage() {
  return (
    <StaticPage title="Contato" description="Fale com a redação: correções, sugestões de pauta e parcerias." path="/contato">
      {(_, email) => (
        <>
          <p>Correções, sugestões de pauta, denúncias de conteúdo e pedidos relacionados aos seus dados pessoais são bem-vindos.</p>
          {email ? (
            <p>
              <a className="btn btn--primary" href={`mailto:${email}`}>
                <Mail size={16} aria-hidden="true" /> {email}
              </a>
            </p>
          ) : (
            <p>
              Enquanto o e-mail de contato não é configurado, envie sua mensagem pelo nosso repositório público:{' '}
              <a href={`${REPO_URL}/issues`} target="_blank" rel="noopener noreferrer">
                abrir uma solicitação no GitHub
              </a>
              . Não inclua dados pessoais sensíveis em mensagens públicas.
            </p>
          )}
          <p className="muted">
            Para assuntos oficiais do jogo (suporte, compras, contas), procure diretamente a Rockstar Games: não temos acesso a esses sistemas.
          </p>
        </>
      )}
    </StaticPage>
  );
}

export function PrivacyPage() {
  return (
    <StaticPage title="Política de privacidade" description="Como o portal trata dados pessoais, em conformidade com a LGPD." path="/politica-de-privacidade">
      {(name, email) => (
        <>
          <p>
            <em>Última atualização: 12 de outubro de 2026.</em>
          </p>
          <p>
            Esta política explica como o {name} trata dados pessoais, em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018 —
            LGPD).
          </p>
          <h2>O que coletamos</h2>
          <ul>
            <li>
              <strong>Visitas:</strong> contamos visualizações por página e por dia, de forma agregada. Não registramos endereço IP, identificadores de
              dispositivo ou perfis de navegação, e não usamos cookies de rastreamento.
            </li>
            <li>
              <strong>Cliques em links de afiliados e canais:</strong> registramos qual link foi clicado, a posição na página, o domínio de origem e a
              data. Não há identificação do visitante. Esses registros são apagados após 180 dias.
            </li>
            <li>
              <strong>Área administrativa:</strong> para a equipe editorial, guardamos e-mail, nome, papel e um cookie de sessão estritamente necessário
              ao login.
            </li>
          </ul>
          <h2>Serviços de terceiros</h2>
          <p>
            Ao clicar em um link de loja (por exemplo, Amazon) ou de canal (Telegram, WhatsApp), você passa a estar sujeito às políticas desses
            serviços, que podem usar cookies próprios. Recomendamos ler a política de privacidade de cada um.
          </p>
          <h2>Canais de Telegram e WhatsApp</h2>
          <p>
            A entrada nos canais é sempre voluntária, por meio do link de convite. Não adicionamos pessoas automaticamente, não enviamos mensagens sem
            consentimento e não compartilhamos dados de participantes.
          </p>
          <h2>Seus direitos</h2>
          <p>
            Você pode solicitar confirmação de tratamento, acesso, correção ou exclusão de dados pessoais
            {email ? (
              <>
                {' '}pelo e-mail <a href={`mailto:${email}`}>{email}</a>
              </>
            ) : (
              <> pela página de <Link to="/contato">contato</Link></>
            )}
            .
          </p>
          <h2>Segurança</h2>
          <p>Senhas da equipe são armazenadas com hash seguro, as comunicações usam HTTPS e o acesso administrativo é registrado em histórico de auditoria.</p>
        </>
      )}
    </StaticPage>
  );
}

export function TermsPage() {
  return (
    <StaticPage title="Termos de uso" description="Condições de uso do portal." path="/termos">
      {(name) => (
        <>
          <p>
            Ao usar o {name}, você concorda com estes termos. O conteúdo é informativo e editorial. Fazemos o possível para mantê-lo correto e
            atualizado, mas informações sobre jogos não lançados podem mudar.
          </p>
          <h2>Marcas e propriedade intelectual</h2>
          <p>
            Grand Theft Auto, GTA, Rockstar Games e marcas relacionadas pertencem aos seus respectivos donos e são citadas apenas para fins
            jornalísticos e informativos. Os textos e ilustrações originais do portal pertencem ao {name}.
          </p>
          <h2>Links externos</h2>
          <p>Não nos responsabilizamos pelo conteúdo, pelos preços ou pela disponibilidade em sites de terceiros.</p>
          <h2>Glitches e descobertas</h2>
          <p>Reproduzir glitches pode corromper salvamentos ou violar regras de modos online. Faça isso por sua conta e risco.</p>
        </>
      )}
    </StaticPage>
  );
}

export function DisclosurePage() {
  return (
    <StaticPage title="Publicidade e links de afiliados" description="Como funcionam os links de afiliados e os espaços publicitários do portal." path="/divulgacao">
      {(name) => (
        <>
          <p>
            O {name} se mantém em parte com <strong>links de afiliados</strong>. Quando você compra algo por um desses links, podemos receber uma
            comissão da loja, <strong>sem custo extra para você</strong>.
          </p>
          <ul>
            <li>Banners e produtos com link afiliado são identificados como <span className="badge badge--ad">Publicidade</span> ou <span className="badge badge--ad">Afiliado</span>.</li>
            <li>Como participante do Programa de Associados da Amazon, o portal pode ser remunerado por compras qualificadas.</li>
            <li>Não inventamos preços, descontos, estoque ou urgência. Preços só aparecem quando foram verificados nas últimas 24 horas, com data e hora.</li>
            <li>Não temos patrocínio nem parceria oficial com Rockstar Games, PlayStation, Xbox ou Amazon.</li>
            <li>As escolhas editoriais não dependem de comissões. Notícias e análises não são pagas.</li>
          </ul>
        </>
      )}
    </StaticPage>
  );
}

export function NotFound() {
  const site = useSite();
  useSeo({ title: 'Página não encontrada', description: 'A página procurada não existe.', path: '/404', siteName: site.data?.settings.siteName ?? 'Project GTA IV', noindex: true });
  return (
    <div className="container section">
      <div className="state">
        <Compass size={40} aria-hidden="true" />
        <h1 style={{ fontSize: '1.8rem', margin: 0 }}>Página não encontrada</h1>
        <p>O endereço pode ter mudado ou o conteúdo foi removido.</p>
        <div className="row" style={{ justifyContent: 'center' }}>
          <Link className="btn btn--primary" to="/">
            Ir para o início
          </Link>
          <Link className="btn btn--ghost" to="/busca">
            Buscar no site
          </Link>
        </div>
      </div>
    </div>
  );
}
