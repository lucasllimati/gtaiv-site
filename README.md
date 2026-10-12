# Project GTA IV

Portal editorial **independente** sobre GTA VI: notícias verificadas, rumores identificados, guia do universo, glitches com evidência, estúdio de conteúdo para redes sociais e monetização por afiliados.

> Não é um site oficial. Sem vínculo com Rockstar Games, Take-Two, Sony, Microsoft ou Amazon. O nome do portal é configurável no painel.

## Arquitetura

```
apps/web        React + TypeScript + Vite — site público e painel administrativo
apps/api        Fastify + TypeScript — API pública, API administrativa, autenticação, mídia
apps/pipeline   Coleta de fontes (RSS), deduplicação, classificação e exportação do snapshot
packages/db     Schema Drizzle (SQLite/libSQL), migrações, conteúdo-base e montagem dos dados públicos
packages/shared Vocabulário editorial, validação (Zod) e utilitários compartilhados
```

O site funciona em dois modos:

| Modo | Onde roda | Dados | Painel |
| --- | --- | --- | --- |
| `snapshot` | GitHub Pages / Cloudflare Pages (estático) | `/data/*.json` gerados no build | Link para o servidor da API |
| `api` | Servidor Node (Render, Fly, VPS) que serve site + API | Ao vivo, com fallback para o snapshot | Disponível em `/admin` |

O painel exige a mesma origem da API, pois o cookie de sessão é `SameSite=Strict` e `httpOnly`. Por isso, em produção, a API serve também o build do frontend.

## Começando

Requisitos: Node 22.12+ (testado com Node 24) e npm 10+.

```bash
npm install
cp .env.example .env          # ajuste se quiser
npm run db:seed               # cria o banco local (.local/dev.db) com o conteúdo-base
ADMIN_PASSWORD='uma-senha-longa-aqui' npm run admin:create -- --email voce@exemplo.com --name "Seu Nome"
npm run pipeline              # coleta as fontes RSS (opcional)
npm run export                # gera o snapshot público em apps/web/public
npm run dev:api               # API em http://localhost:8787
VITE_DATA_MODE=api npm run dev:web   # site em http://localhost:5173 (painel em /admin)
```

No Windows (PowerShell), defina as variáveis antes do comando: `$env:ADMIN_PASSWORD='...'; npm run admin:create -- --email ...`.

## Comandos

| Comando | O que faz |
| --- | --- |
| `npm run check` | Tipos, lint, testes e build (o mesmo que o CI executa) |
| `npm test` | Testes unitários e de integração (Vitest) |
| `npm run db:generate` | Gera uma migração após alterar `packages/db/src/schema.ts` |
| `npm run db:migrate` | Aplica as migrações |
| `npm run pipeline` | Executa a coleta (`-- --source=ID` para reprocessar uma fonte) |
| `npm run export` | Exporta `site.json`, artigos, `sitemap.xml`, `rss.xml` e `robots.txt` |
| `npm run build` | Build do frontend com pré-renderização de todas as rotas públicas |

## Publicação

### Site estático (GitHub Pages) — já configurado

O workflow `.github/workflows/pages.yml` publica a versão estática a cada push na `main`, uma vez por dia e quando a API dispara o evento `content-updated`. Sem banco remoto, o site usa o conteúdo-base do repositório.

Para ativar: em *Settings → Pages*, selecione **GitHub Actions** como fonte.

### API + painel (necessário para editar conteúdo)

1. Crie um banco persistente no [Turso](https://turso.tech) (plano gratuito) e anote a URL `libsql://…` e o token.
2. Crie um bucket no Cloudflare R2 com domínio público para mídia (opcional, mas recomendado).
3. Faça o deploy da API com `render.yaml` (Render) ou com o `Dockerfile` (Fly.io, Railway, VPS) e configure as variáveis do `.env.example`.
4. Crie o administrador: `npm run admin:create` com `DATABASE_URL` apontando para o banco de produção.
5. No GitHub, cadastre os secrets `DATABASE_URL` e `DATABASE_AUTH_TOKEN` (habilita a coleta agendada e o snapshot com conteúdo real) e as variáveis `ADMIN_URL` e `MEDIA_PUBLIC_URL`.
6. Opcional: configure `GITHUB_DISPATCH_TOKEN` na API para republicar o site estático automaticamente ao publicar conteúdo.

> Cloudflare Workers não executa Fastify como um servidor Node tradicional. A API precisa de um host Node, e o frontend pode ficar em qualquer CDN estática.

## Regras editoriais implementadas

- Status de verificação: Confirmado, Reportado, Rumor, Teoria, Desmentido, Desatualizado e Em revisão.
- Fluxo: rascunho → revisão → **aprovação humana** (registra quem e quando) → publicação, que só um administrador pode fazer.
- A aprovação exige pelo menos uma fonte, e rascunhos automáticos não podem ser aprovados sem reescrita.
- Cada artigo exibe suas fontes e uma tabela "o que é fato e o que não é" com as afirmações e as evidências.
- Preços só aparecem quando foram verificados nas últimas 24 horas; depois disso, o site orienta a consultar a loja.
- Banners e canais nunca exibem links inventados. Sem configuração, aparece um espaço reservado que leva à vitrine interna.

Mais detalhes, riscos e custos: [docs/PLANO-TECNICO.md](docs/PLANO-TECNICO.md).
