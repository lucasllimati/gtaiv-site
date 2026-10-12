import type { GuideKind, VerificationStatus } from '@pgi/shared';

/**
 * Conteúdo-base editorial escrito durante a criação do projeto (12/10/2026),
 * a partir das fontes listadas em cada item. Revisar sempre que a Rockstar
 * publicar novidades — nada aqui é atualizado automaticamente.
 *
 * Regras seguidas: só "confirmed" quando há fonte oficial; especulação
 * marcada como "theory"; nenhum veículo, missão, glitch ou preço inventado.
 */

export const SEED_DATE = '2026-10-12T12:00:00.000Z';
export const SEED_AUTHOR = 'Redação';

const OFFICIAL_SITE = 'https://www.rockstargames.com/VI';
const NEWSWIRE_NOV_2026 =
  'https://www.rockstargames.com/newswire/article/ak3ak31a49a221/grand-theft-auto-vi-is-now-set-to-launch-november-19-2026';
const NEWSWIRE_MAY_2026 =
  'https://www.rockstargames.com/newswire/article/258aa538o412ok/grand-theft-auto-vi-is-now-coming-may-26-2026';
const VGC_PS5_CAPTURE =
  'https://www.videogameschronicle.com/news/rockstar-reiterates-that-the-latest-gta-6-trailer-was-captured-on-ps5';
const VGC_CAST = 'https://www.videogameschronicle.com/news/gta-6s-cast-of-characters-revealed/';

export const seedCategories = [
  { slug: 'oficial', name: 'Notícias oficiais', description: 'Anúncios e materiais publicados pela Rockstar Games.', sortOrder: 1 },
  { slug: 'noticias', name: 'Notícias', description: 'Cobertura da imprensa especializada e da indústria.', sortOrder: 2 },
  { slug: 'rumores', name: 'Rumores e teorias', description: 'Informações não confirmadas, sempre identificadas como tal.', sortOrder: 3 },
  { slug: 'analises', name: 'Análises', description: 'Contexto e interpretação editorial.', sortOrder: 4 },
  { slug: 'guias', name: 'Guias', description: 'Guias práticos e explicações.', sortOrder: 5 },
] as const;

interface SeedArticle {
  slug: string;
  title: string;
  summary: string;
  body: string;
  category: (typeof seedCategories)[number]['slug'];
  verificationStatus: VerificationStatus;
  featured: boolean;
  tags: string[];
  sources: { url: string; title: string; publisher: string; publishedAt: string | null; isPrimary: boolean }[];
  claims: { text: string; status: VerificationStatus; sourceUrl: string | null }[];
}

export const seedArticles: SeedArticle[] = [
  {
    slug: 'gta-vi-lancamento-19-de-novembro-de-2026',
    title: 'GTA VI chega em 19 de novembro de 2026: o que está confirmado',
    summary:
      'A Rockstar Games mantém o lançamento de Grand Theft Auto VI para 19 de novembro de 2026, no PlayStation 5 e no Xbox Series X|S. Veja como a data chegou até aqui.',
    category: 'oficial',
    verificationStatus: 'confirmed',
    featured: true,
    tags: ['lançamento', 'data', 'plataformas'],
    body: `A data de lançamento de **Grand Theft Auto VI** é **19 de novembro de 2026**. É o que informa a página oficial do jogo, consultada pela redação em 12 de outubro de 2026, e o comunicado publicado pela Rockstar Games no Newswire.

## Uma data que mudou duas vezes

O jogo foi apresentado com previsão para 2025. Depois disso, a Rockstar anunciou dois adiamentos:

1. **Primeiro adiamento:** o lançamento passou para **26 de maio de 2026**, conforme comunicado no Newswire.
2. **Segundo adiamento:** a data foi movida para **19 de novembro de 2026**. No anúncio, a empresa pediu desculpas pela espera e disse que os meses extras serviriam para finalizar o jogo com o nível de acabamento esperado.

## Plataformas

A página oficial lista **PlayStation 5** e **Xbox Series X|S**. Até a data desta publicação, não há anúncio oficial de versão para PC. Tratamos esse tema separadamente, em uma análise identificada como especulativa.

## Por que isso importa

Datas de lançamento de jogos grandes podem mudar. Por isso, este portal acompanha a página oficial e o Newswire da Rockstar. Se houver qualquer alteração, este texto será atualizado e marcado como **Desatualizado**, com link para a nova informação.`,
    sources: [
      { url: NEWSWIRE_NOV_2026, title: 'Grand Theft Auto VI is Now Set to Launch November 19, 2026', publisher: 'Rockstar Newswire', publishedAt: null, isPrimary: true },
      { url: OFFICIAL_SITE, title: 'Grand Theft Auto VI — página oficial', publisher: 'Rockstar Games', publishedAt: null, isPrimary: false },
      { url: NEWSWIRE_MAY_2026, title: 'Grand Theft Auto VI is Now Coming May 26, 2026', publisher: 'Rockstar Newswire', publishedAt: null, isPrimary: false },
    ],
    claims: [
      { text: 'GTA VI será lançado em 19 de novembro de 2026.', status: 'confirmed', sourceUrl: NEWSWIRE_NOV_2026 },
      { text: 'As plataformas anunciadas são PlayStation 5 e Xbox Series X|S.', status: 'confirmed', sourceUrl: OFFICIAL_SITE },
      { text: 'A data anterior era 26 de maio de 2026.', status: 'confirmed', sourceUrl: NEWSWIRE_MAY_2026 },
    ],
  },
  {
    slug: 'jason-e-lucia-protagonistas-de-gta-vi',
    title: 'Jason e Lucia: o que a Rockstar já revelou sobre os protagonistas',
    summary:
      'GTA VI terá dois protagonistas, Jason Duval e Lucia Caminos. Reunimos apenas o que foi apresentado pela Rockstar e separamos fatos de interpretação.',
    category: 'oficial',
    verificationStatus: 'confirmed',
    featured: false,
    tags: ['personagens', 'história'],
    body: `A Rockstar apresentou **Jason Duval** e **Lucia Caminos** como a dupla central de Grand Theft Auto VI, nos trailers e na página oficial do jogo.

## Lucia Caminos

A apresentação oficial conta que Lucia passou pela **Penitenciária de Leonida** e que, ao sair, quer evitar voltar para trás das grades. A imprensa especializada destacou que ela é a primeira protagonista feminina da série principal desde o GTA original, de 1997.

## Jason Duval

Jason é descrito como alguém que cresceu cercado de golpistas e quer uma vida mais tranquila, mas acaba envolvido com o tráfico na região de Leonida Keys.

## Fatos x interpretação

- **Confirmado:** os nomes dos dois personagens, o papel de protagonistas e os elementos de biografia citados acima, publicados pela Rockstar.
- **Interpretação:** leituras sobre o destino da dupla, reviravoltas ou finais. A partir das imagens dos trailers, isso é apenas especulação. Quando abordarmos esses temas, o texto será marcado como **Teoria**.

Os demais personagens apresentados oficialmente estão na seção [Personagens](/personagens).`,
    sources: [
      { url: OFFICIAL_SITE, title: 'Grand Theft Auto VI — página oficial', publisher: 'Rockstar Games', publishedAt: null, isPrimary: true },
      { url: VGC_CAST, title: "GTA 6's cast of characters revealed", publisher: 'Video Games Chronicle', publishedAt: null, isPrimary: false },
    ],
    claims: [
      { text: 'Jason Duval e Lucia Caminos são os protagonistas de GTA VI.', status: 'confirmed', sourceUrl: OFFICIAL_SITE },
      { text: 'Lucia esteve na Penitenciária de Leonida.', status: 'confirmed', sourceUrl: OFFICIAL_SITE },
    ],
  },
  {
    slug: 'trailer-2-de-gta-vi-capturado-no-ps5',
    title: 'Trailer 2 de GTA VI foi capturado dentro do jogo em um PS5, diz a Rockstar',
    summary:
      'Segundo a Rockstar, o segundo trailer de GTA VI foi gravado inteiramente dentro do jogo em um PlayStation 5, combinando gameplay e cenas de história.',
    category: 'noticias',
    verificationStatus: 'confirmed',
    featured: false,
    tags: ['trailer', 'ps5', 'tecnologia'],
    body: `Depois da estreia do segundo trailer de Grand Theft Auto VI, em maio de 2025, a Rockstar afirmou que o vídeo foi **capturado inteiramente dentro do jogo em um PlayStation 5**. O material mistura trechos de gameplay e cenas de história.

## O que exatamente foi dito

A Rockstar não especificou se o console usado era o PS5 padrão ou o PS5 Pro. Segundo a cobertura do Video Games Chronicle, análises técnicas independentes indicaram o modelo padrão. Como a própria Rockstar não confirmou o modelo, tratamos esse ponto como **Reportado**, e não como confirmado.

## Por que isso é relevante

Trailers costumam ser editados para marketing, e a declaração não garante como o jogo vai rodar em todas as situações. Ela é útil como referência, mas o desempenho final só poderá ser avaliado no lançamento.`,
    sources: [
      { url: VGC_PS5_CAPTURE, title: 'Rockstar reiterates that the latest GTA 6 trailer was captured on PS5', publisher: 'Video Games Chronicle', publishedAt: null, isPrimary: true },
    ],
    claims: [
      { text: 'A Rockstar afirmou que o Trailer 2 foi capturado dentro do jogo em um PlayStation 5.', status: 'confirmed', sourceUrl: VGC_PS5_CAPTURE },
      { text: 'O console usado seria o PS5 padrão, não o PS5 Pro.', status: 'reported', sourceUrl: VGC_PS5_CAPTURE },
    ],
  },
  {
    slug: 'gta-vi-no-pc-fato-e-especulacao',
    title: 'GTA VI no PC: o que é fato e o que é especulação',
    summary:
      'Não há anúncio oficial de GTA VI para PC. O histórico da Rockstar sugere que uma versão pode vir depois, mas isso é uma hipótese, não informação confirmada.',
    category: 'rumores',
    verificationStatus: 'theory',
    featured: false,
    tags: ['pc', 'plataformas', 'especulação'],
    body: `> **Atenção:** este texto é uma **análise especulativa**. O único fato verificável é a ausência de anúncio oficial para PC.

## O fato

A página oficial de Grand Theft Auto VI lista apenas **PlayStation 5** e **Xbox Series X|S**. Não há data, anúncio ou confirmação de uma versão para PC.

## O histórico

Nos lançamentos mais recentes da Rockstar, a versão de PC chegou depois da de consoles:

- **GTA V** foi lançado para consoles em 2013 e chegou ao PC em 2015.
- **Red Dead Redemption 2** foi lançado para consoles em 2018 e chegou ao PC em 2019.

## A hipótese

Com base nesse padrão, é razoável **supor** que uma versão para PC possa ser anunciada no futuro. Isso não significa que ela exista, nem permite prever uma data. Qualquer prazo que circule sem fonte oficial deve ser tratado como **rumor**.

Atualizaremos este texto se a Rockstar fizer qualquer anúncio.`,
    sources: [
      { url: OFFICIAL_SITE, title: 'Grand Theft Auto VI — página oficial (plataformas)', publisher: 'Rockstar Games', publishedAt: null, isPrimary: true },
    ],
    claims: [
      { text: 'Não há anúncio oficial de GTA VI para PC.', status: 'confirmed', sourceUrl: OFFICIAL_SITE },
      { text: 'Uma versão para PC pode ser lançada depois das versões de console.', status: 'theory', sourceUrl: null },
    ],
  },
  {
    slug: 'leonida-regioes-reveladas',
    title: 'Leonida: as regiões que a Rockstar já mostrou',
    summary:
      'Vice City é a cidade mais conhecida, mas o estado fictício de Leonida tem outras regiões apresentadas oficialmente. Conheça cada uma.',
    category: 'guias',
    verificationStatus: 'confirmed',
    featured: false,
    tags: ['mapa', 'leonida', 'vice city'],
    body: `Grand Theft Auto VI se passa no estado fictício de **Leonida**, onde fica **Vice City**. Além da cidade, a página oficial do jogo apresentou outras regiões:

- **Vice City**: a metrópole central da história.
- **Leonida Keys**: um arquipélago ao sul do estado.
- **Grassrivers**: uma região de áreas alagadas e natureza selvagem.
- **Port Gellhorn**: uma cidade litorânea.
- **Ambrosia**: uma área do interior.
- **Mount Kalaga National Park**: um parque nacional com áreas de mata e montanha.

## O que ainda não sabemos

O tamanho do mapa, a forma de navegar entre as regiões e quais áreas estarão disponíveis desde o início do jogo **não foram confirmados**. Mapas "vazados" ou criados por fãs que circulam na internet não são oficiais.

Veja mais detalhes na seção [Mapa e locais](/mapa).`,
    sources: [
      { url: OFFICIAL_SITE, title: 'Grand Theft Auto VI — página oficial (lugares)', publisher: 'Rockstar Games', publishedAt: null, isPrimary: true },
    ],
    claims: [
      { text: 'GTA VI se passa no estado de Leonida, que inclui Vice City.', status: 'confirmed', sourceUrl: OFFICIAL_SITE },
      { text: 'O tamanho total do mapa ainda não foi divulgado.', status: 'confirmed', sourceUrl: null },
    ],
  },
];

interface SeedGuide {
  kind: GuideKind;
  slug: string;
  title: string;
  summary: string;
  body?: string;
  verificationStatus: VerificationStatus;
  eventDate?: string;
  sortOrder: number;
  sources: { url: string; label: string }[];
}

const off = [{ url: OFFICIAL_SITE, label: 'Página oficial de GTA VI' }];

export const seedGuide: SeedGuide[] = [
  // Cronologia
  {
    kind: 'history',
    slug: 'desenvolvimento-confirmado',
    title: 'Rockstar confirma o desenvolvimento do próximo GTA',
    summary: 'A Rockstar Games anunciou publicamente que o desenvolvimento do próximo Grand Theft Auto estava em andamento.',
    verificationStatus: 'confirmed',
    eventDate: '2022-02-04',
    sortOrder: 10,
    sources: [{ url: 'https://www.rockstargames.com/newswire', label: 'Rockstar Newswire' }],
  },
  {
    kind: 'history',
    slug: 'trailer-1',
    title: 'Trailer 1 e anúncio oficial de Grand Theft Auto VI',
    summary: 'O primeiro trailer apresentou Vice City, Lucia e a previsão de lançamento para 2025.',
    verificationStatus: 'confirmed',
    eventDate: '2023-12-05',
    sortOrder: 20,
    sources: [...off],
  },
  {
    kind: 'history',
    slug: 'adiamento-maio-2026',
    title: 'Primeiro adiamento: 26 de maio de 2026',
    summary: 'A Rockstar adiou o lançamento de 2025 para 26 de maio de 2026.',
    verificationStatus: 'outdated',
    eventDate: '2025-05-02',
    sortOrder: 30,
    sources: [{ url: NEWSWIRE_MAY_2026, label: 'Rockstar Newswire' }],
  },
  {
    kind: 'history',
    slug: 'trailer-2',
    title: 'Trailer 2 e nova página oficial',
    summary: 'O segundo trailer apresentou Jason Duval e foi acompanhado de uma página oficial com personagens e regiões de Leonida.',
    verificationStatus: 'confirmed',
    eventDate: '2025-05-06',
    sortOrder: 40,
    sources: [...off, { url: VGC_PS5_CAPTURE, label: 'Video Games Chronicle' }],
  },
  {
    kind: 'history',
    slug: 'adiamento-novembro-2026',
    title: 'Segundo adiamento: 19 de novembro de 2026',
    summary: 'A Rockstar moveu o lançamento para 19 de novembro de 2026, citando a necessidade de mais tempo para o acabamento do jogo.',
    verificationStatus: 'confirmed',
    eventDate: '2025-11-06',
    sortOrder: 50,
    sources: [{ url: NEWSWIRE_NOV_2026, label: 'Rockstar Newswire' }],
  },
  {
    kind: 'history',
    slug: 'lancamento',
    title: 'Lançamento previsto',
    summary: 'Data anunciada para o lançamento no PlayStation 5 e no Xbox Series X|S.',
    verificationStatus: 'confirmed',
    eventDate: '2026-11-19',
    sortOrder: 60,
    sources: [{ url: NEWSWIRE_NOV_2026, label: 'Rockstar Newswire' }, ...off],
  },
  // Personagens
  { kind: 'character', slug: 'lucia-caminos', title: 'Lucia Caminos', summary: 'Protagonista. Passou pela Penitenciária de Leonida e, ao sair, busca não voltar para trás das grades.', verificationStatus: 'confirmed', sortOrder: 1, sources: [...off] },
  { kind: 'character', slug: 'jason-duval', title: 'Jason Duval', summary: 'Protagonista. Cresceu cercado de golpistas, quer uma vida tranquila e acaba envolvido com o tráfico em Leonida Keys.', verificationStatus: 'confirmed', sortOrder: 2, sources: [...off] },
  { kind: 'character', slug: 'cal-hampton', title: 'Cal Hampton', summary: 'Amigo e parceiro de Jason, apresentado na página oficial.', verificationStatus: 'confirmed', sortOrder: 3, sources: [...off, { url: VGC_CAST, label: 'Video Games Chronicle' }] },
  { kind: 'character', slug: 'boobie-ike', title: 'Boobie Ike', summary: 'Empresário de Vice City com negócios em diferentes áreas, apresentado na página oficial.', verificationStatus: 'confirmed', sortOrder: 4, sources: [...off, { url: VGC_CAST, label: 'Video Games Chronicle' }] },
  { kind: 'character', slug: 'drequan-priest', title: "Dre'Quan Priest", summary: 'Empresário musical que busca transformar artistas em sucesso, apresentado na página oficial.', verificationStatus: 'confirmed', sortOrder: 5, sources: [...off, { url: VGC_CAST, label: 'Video Games Chronicle' }] },
  { kind: 'character', slug: 'real-dimez', title: 'Real Dimez', summary: 'Dupla musical (Bae-Luxe e Roxy) conhecida nas redes sociais, apresentada na página oficial.', verificationStatus: 'confirmed', sortOrder: 6, sources: [...off, { url: VGC_CAST, label: 'Video Games Chronicle' }] },
  { kind: 'character', slug: 'raul-bautista', title: 'Raul Bautista', summary: 'Assaltante de bancos experiente, apresentado na página oficial.', verificationStatus: 'confirmed', sortOrder: 7, sources: [...off, { url: VGC_CAST, label: 'Video Games Chronicle' }] },
  { kind: 'character', slug: 'brian-heder', title: 'Brian Heder', summary: 'Veterano do contrabando nas Keys, apresentado na página oficial.', verificationStatus: 'confirmed', sortOrder: 8, sources: [...off, { url: VGC_CAST, label: 'Video Games Chronicle' }] },
  // Locais
  { kind: 'location', slug: 'vice-city', title: 'Vice City', summary: 'Metrópole central de Leonida e principal cenário apresentado nos trailers.', verificationStatus: 'confirmed', sortOrder: 1, sources: [...off] },
  { kind: 'location', slug: 'leonida-keys', title: 'Leonida Keys', summary: 'Arquipélago ao sul do estado.', verificationStatus: 'confirmed', sortOrder: 2, sources: [...off] },
  { kind: 'location', slug: 'grassrivers', title: 'Grassrivers', summary: 'Região de áreas alagadas e natureza selvagem.', verificationStatus: 'confirmed', sortOrder: 3, sources: [...off] },
  { kind: 'location', slug: 'port-gellhorn', title: 'Port Gellhorn', summary: 'Cidade litorânea de Leonida.', verificationStatus: 'confirmed', sortOrder: 4, sources: [...off] },
  { kind: 'location', slug: 'ambrosia', title: 'Ambrosia', summary: 'Área do interior de Leonida.', verificationStatus: 'confirmed', sortOrder: 5, sources: [...off] },
  { kind: 'location', slug: 'mount-kalaga', title: 'Mount Kalaga National Park', summary: 'Parque nacional com áreas de mata e montanha.', verificationStatus: 'confirmed', sortOrder: 6, sources: [...off] },
  // FAQ
  { kind: 'faq', slug: 'quando-lanca', title: 'Quando GTA VI será lançado?', summary: 'A data anunciada é 19 de novembro de 2026.', body: 'Informação confirmada pela Rockstar no Newswire e na página oficial do jogo. Se a data mudar, este item será atualizado.', verificationStatus: 'confirmed', sortOrder: 1, sources: [{ url: NEWSWIRE_NOV_2026, label: 'Rockstar Newswire' }] },
  { kind: 'faq', slug: 'plataformas', title: 'Em quais plataformas GTA VI será lançado?', summary: 'PlayStation 5 e Xbox Series X|S.', body: 'Não há anúncio oficial para PC até a data desta atualização.', verificationStatus: 'confirmed', sortOrder: 2, sources: [...off] },
  { kind: 'faq', slug: 'onde-se-passa', title: 'Onde se passa GTA VI?', summary: 'No estado fictício de Leonida, que inclui Vice City.', verificationStatus: 'confirmed', sortOrder: 3, sources: [...off] },
  { kind: 'faq', slug: 'site-oficial', title: 'Este portal é oficial?', summary: 'Não. Este é um portal independente, sem vínculo com a Rockstar Games, Take-Two, Sony, Microsoft ou Amazon.', body: 'Grand Theft Auto, GTA e marcas relacionadas pertencem aos seus respectivos donos. Para informações oficiais, consulte o site da Rockstar Games.', verificationStatus: 'confirmed', sortOrder: 4, sources: [] },
  { kind: 'faq', slug: 'preco', title: 'Quanto vai custar GTA VI?', summary: 'Consulte as lojas e a página oficial. O portal só exibe preços verificados recentemente.', body: 'A vitrine do portal mostra apenas preços conferidos nas lojas nas últimas 24 horas. Se o preço estiver desatualizado, mostramos a indicação "consultar na loja".', verificationStatus: 'confirmed', sortOrder: 5, sources: [] },
];

export const seedFacts = [
  { key: 'releaseDate', value: '19 de novembro de 2026', status: 'confirmed' as const, sourceUrl: NEWSWIRE_NOV_2026 },
  { key: 'platforms', value: 'PS5 · Xbox Series X|S', status: 'confirmed' as const, sourceUrl: OFFICIAL_SITE },
  { key: 'developer', value: 'Rockstar Games', status: 'confirmed' as const, sourceUrl: OFFICIAL_SITE },
  { key: 'setting', value: 'Vice City, Leonida', status: 'confirmed' as const, sourceUrl: OFFICIAL_SITE },
];

const GTA_KEYWORDS = ['gta 6', 'gta vi', 'grand theft auto vi', 'grand theft auto 6', 'gta6'];

export const seedSources = [
  {
    name: 'Rockstar Newswire',
    siteUrl: 'https://www.rockstargames.com/newswire',
    feedUrl: null,
    type: 'official' as const,
    method: 'manual' as const,
    reliability: 5,
    enabled: true,
    keywords: [],
    notes:
      'Fonte oficial primária. O Newswire é renderizado por JavaScript e não oferece feed RSS público. Acompanhar manualmente ou por notificação oficial.',
  },
  {
    name: 'Página oficial de GTA VI',
    siteUrl: 'https://www.rockstargames.com/VI',
    feedUrl: null,
    type: 'official' as const,
    method: 'manual' as const,
    reliability: 5,
    enabled: true,
    keywords: [],
    notes: 'Referência para data, plataformas, personagens e locais. Conferir antes de alterar fatos da home.',
  },
  { name: 'IGN', siteUrl: 'https://www.ign.com', feedUrl: 'https://feeds.feedburner.com/ign/games-all', type: 'press' as const, method: 'rss' as const, reliability: 4, enabled: true, keywords: GTA_KEYWORDS, notes: 'Feed RSS público. Usamos título, link e resumo do feed.' },
  { name: 'GameSpot', siteUrl: 'https://www.gamespot.com', feedUrl: 'https://www.gamespot.com/feeds/news/', type: 'press' as const, method: 'rss' as const, reliability: 4, enabled: true, keywords: GTA_KEYWORDS, notes: 'Feed RSS público de notícias.' },
  { name: 'Eurogamer', siteUrl: 'https://www.eurogamer.net', feedUrl: 'https://www.eurogamer.net/feed', type: 'press' as const, method: 'rss' as const, reliability: 4, enabled: true, keywords: GTA_KEYWORDS, notes: 'Feed RSS público.' },
  { name: 'Video Games Chronicle', siteUrl: 'https://www.videogameschronicle.com', feedUrl: 'https://www.videogameschronicle.com/feed/', type: 'press' as const, method: 'rss' as const, reliability: 4, enabled: true, keywords: GTA_KEYWORDS, notes: 'Feed RSS público.' },
  { name: 'PC Gamer', siteUrl: 'https://www.pcgamer.com', feedUrl: 'https://www.pcgamer.com/rss/', type: 'press' as const, method: 'rss' as const, reliability: 4, enabled: true, keywords: GTA_KEYWORDS, notes: 'Feed RSS público.' },
  {
    name: 'Reddit r/GTA6',
    siteUrl: 'https://www.reddit.com/r/GTA6/',
    feedUrl: 'https://www.reddit.com/r/GTA6/.rss',
    type: 'community' as const,
    method: 'rss' as const,
    reliability: 1,
    enabled: false,
    keywords: [],
    notes:
      'Desativada por padrão. Serve como pista, nunca como confirmação. Revise os termos de uso da API do Reddit antes de ativar.',
  },
];

export const seedSettings = {
  siteName: 'Project GTA IV',
  tagline: 'Notícias verificadas, guias e descobertas sobre GTA VI',
  contactEmail: '',
};
