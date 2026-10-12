# Plano técnico e relatório de implementação

Data: 12/10/2026.

## Fase 1 — Auditoria

**Estado encontrado:** repositório `gtaiv-site` com apenas `LICENSE` (MIT), `.gitattributes` e um commit inicial, sem remote. Não havia frontend, backend, banco, testes, pipeline ou integrações.

**End Zone Analytics:** não foi encontrado nesta máquina (busca em Downloads, Documents e Codigo). Nada foi reaproveitado; a stack segue a recomendação (React, TypeScript, Vite e Fastify).

**Toolchain:** Node 24.11.1 e npm 11.18. Não há Docker, GitHub CLI nem Wrangler instalados.

**Fatos verificados antes de escrever o conteúdo-base:** a página oficial e o Rockstar Newswire indicam lançamento em 19/11/2026 para PS5 e Xbox Series X|S. A pré-venda em 25/06/2026 aparece apenas em fontes secundárias e não foi publicada como fato.

## Decisões técnicas

| Decisão | Motivo |
| --- | --- |
| Monorepo com npm workspaces | Separa web, API, pipeline e banco sem ferramentas extras |
| SQLite/libSQL com Drizzle | Arquivo local no desenvolvimento e Turso (persistente, plano gratuito) em produção, sem depender de disco efêmero |
| Site público estático com snapshot JSON + pré-renderização | Hospedagem gratuita, rápida e com bom SEO; continua no ar mesmo se a API cair |
| API serve o frontend em produção | Cookie de sessão `SameSite=Strict` exige a mesma origem para o painel |
| Sessão em cookie `httpOnly` + token CSRF + bloqueio após 5 tentativas | Evita expor tokens a JavaScript e protege contra CSRF e força bruta |
| Senhas com scrypt (`node:crypto`) | Seguro, sem dependências nativas |
| IA opcional (`claude-opus-5-5`, saída estruturada) com limite diário | Sem chave, há um modelo determinístico; o custo fica sob controle |
| Artes e vídeo renderizados no navegador (Canvas + MediaRecorder) | Custo zero de servidor; não depende de serviços pagos |
| Ilustrações vetoriais originais geradas por código | Nenhuma imagem de terceiros; identidade visual própria |
| Métricas agregadas, sem IP nem cookies de rastreamento | Conformidade com a LGPD por padrão |

## Status por fase

| Fase | Status | Observações |
| --- | --- | --- |
| 1. Auditoria e plano | Concluída | Este documento |
| 2. Identidade visual, home e páginas | Concluída | 18 rotas públicas, busca, filtros, paginação, estados de carregamento, erro, vazio e dados desatualizados |
| 3. Banco, API, painel e autenticação | Concluída | 22 tabelas, papéis admin/editor/leitor validados no backend, histórico de auditoria |
| 4. Monitoramento e revisão | Concluída | 5 feeds RSS de imprensa ativos, robots.txt, ETag, deduplicação por URL, guid e similaridade de título, fila, comparação lado a lado |
| 5. Estúdio de conteúdo | Concluída (MVP) | Pacote com 3 títulos, roteiros de 15/30/60 s, legendas, cenas, artes em 4 formatos e vídeo WebM |
| 6. Afiliados, banners e canais | Concluída (MVP) | Banners com período e prioridade, vitrine com expiração de preço, cliques rastreados, mensagens para canais |
| 7. Testes, segurança e publicação | Concluída para o site estático | 54 testes, lint, CSP, CORS, rate limit; o deploy da API depende das suas contas (ver pendências) |

## Pendências e limitações conhecidas

1. **API em produção:** precisa de uma conta em um host Node (Render, Fly) e no Turso. Sem isso, o site publicado é estático e o painel não fica acessível online.
2. **Fontes oficiais:** o Rockstar Newswire não tem RSS público e é renderizado por JavaScript. Está cadastrado como acompanhamento manual.
3. **Preços:** não há integração automática com a API de produtos da Amazon (PA-API exige aprovação e vendas qualificadas). Os preços são informados manualmente, com data de verificação, e expiram em 24 horas.
4. **Publicação automática em redes e canais:** não implementada. O fluxo é exportar e copiar; integrar exige credenciais e aprovação das APIs oficiais.
5. **Vídeo:** o WebM gerado no navegador não traz metadado de duração nem narração. Algumas redes exigem MP4 (converta com `ffmpeg -i video.webm video.mp4`).
6. **Busca:** feita no navegador sobre o snapshot. Atende a algumas centenas de artigos; acima disso, recomenda-se busca no servidor.
7. **Marca:** "GTA" é marca registrada da Rockstar/Take-Two. Recomenda-se uma marca original antes de investir em domínio e redes sociais. O nome é configurável no painel.
8. **Coletores `api` e `page`:** previstos no modelo de dados, mas não implementados.

## Riscos e custos

| Item | Gratuito? | Risco e limite |
| --- | --- | --- |
| GitHub Pages | Sim (repositório público) | 1 GB por site, 100 GB/mês de banda; uso comercial deve respeitar os termos do GitHub |
| GitHub Actions | Sim em repositório público | A coleta a cada 3 h e o build diário consomem minutos (ilimitados em público) |
| Turso | Plano gratuito | Limites de armazenamento e leituras; faça backups periódicos (`turso db shell … .dump`) |
| Render (API) | Plano gratuito | Hiberna após inatividade (primeira requisição lenta); disco efêmero, por isso use Turso e R2 |
| Cloudflare R2 | 10 GB grátis | Cobrança por armazenamento e operações acima disso |
| Claude API | Pago por uso | `AI_DAILY_LIMIT` limita chamadas por dia; cada rascunho e pacote é uma chamada |
| Feeds de terceiros | — | Podem mudar ou bloquear acessos; a pipeline registra falhas e preserva os dados anteriores |

## Segurança e privacidade

- Segredos apenas em variáveis de ambiente (`.env` está no `.gitignore`; o frontend não recebe segredos).
- Validação com Zod em todas as entradas administrativas; Markdown sanitizado com DOMPurify.
- CSP, `X-Content-Type-Options`, `frame-ancestors 'none'`, CORS restrito e rate limit global e por rota (login, coleta, IA, cliques).
- Redirecionador `/go` lê o destino do banco, o que impede redirecionamento aberto.
- Uploads validados pelos bytes do arquivo (não pela extensão), com limite de tamanho.
- Logs omitem cookies, tokens e senhas; o histórico de auditoria remove campos sensíveis.
- Retenção: cliques são apagados após 180 dias (`/admin/config` → “Aplicar política de retenção”).
