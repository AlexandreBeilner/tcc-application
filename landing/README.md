# Landing da Selucra

Site estático (HTML, CSS e JS puros, sem React) publicado em `selucra.com.br`. O app fica em `app.selucra.com.br`.
Decisões e tarefas: `.claude/backlog-lancamento-web-pwa.md`, Fase 6.

## Comandos

```bash
npm install
npm run build   # gera dist/ (SITE_URL e APP_URL mudam os links; padrão: produção)
npm test        # builda numa pasta temporária e verifica SEO, JSON-LD, links e gráficos
```

Para ver local: `npm run dev` (abre em http://localhost:4173, rebuilda ao salvar; os botões apontam para o app em http://localhost:5173, que você sobe com `npm run dev` em `frontend/`).

O servidor local comprime em gzip como o Cloudflare Pages, para o Lighthouse medir o tamanho real. `npm run format:check` e `npm test` rodam no CI (`.github/workflows/landing-ci.yml`).

## Analytics (Cloudflare Web Analytics)

A home e os guias carregam o beacon da Cloudflare (visitas, origem, país e Core Web Vitals, sem cookies) quando a variável
`CF_ANALYTICS_TOKEN` existe no build. Sem ela, nada é carregado (é o caso do `npm run dev`). O token tem 32 caracteres, aparece no
HTML e não é segredo. A CSP em `src/static/_headers` libera só `static.cloudflareinsights.com` (script) e `cloudflareinsights.com`
(envio). A política de privacidade do app cita essa medição. O Web Analytics não registra eventos de clique: o funil até o cadastro
se vê pelas visitas ao `/login` do app.

## Publicar no Cloudflare Pages

Pré-requisitos: o domínio `selucra.com.br` com a zona ativa na Cloudflare (nameservers do Registro.br apontados para ela) e o repositório
no GitHub. Os botões da landing levam ao app em `https://app.selucra.com.br`, que precisa estar no ar (LW.3.16) para "Entrar" e
"Criar conta" funcionarem.

1. **Projeto.** Cloudflare, Workers & Pages, Create, Pages, Connect to Git, escolha o repositório. Nome: `selucra-landing`. Branch de
   produção: `main`.
2. **Build.** Framework preset: None. Root directory: `landing`. Build command: `npm ci && npm run build`. Build output directory:
   `dist`. O build lê `backend/src/modules/lessons/domain/regulatoryFacts.ts`; o Pages clona o repositório inteiro, então isso
   funciona, mas não use "shallow" nem restrinja o checkout a `landing/`.
3. **Variáveis** (Settings, Variables and secrets, Production):
    - `NODE_VERSION` = `22`
    - `CF_ANALYTICS_TOKEN` = o token do Web Analytics (passo 6). Opcional: sem ele, nada é medido.
    - `SITE_URL` e `APP_URL` só se forem diferentes de `https://selucra.com.br` e `https://app.selucra.com.br` (o padrão já é produção).
4. **Build watch paths** (Settings, Build, Build watch paths): inclua `landing/*` e
   `backend/src/modules/lessons/domain/regulatoryFacts.ts`, para o Pages não rebuildar a cada commit do resto do monorepo.
5. **Domínios** (aba Custom domains): adicione `selucra.com.br` e `www.selucra.com.br`. Como a zona está na mesma conta, a Cloudflare cria
   os registros sozinha.
   Depois, para o `www` apontar para o domínio raiz: Rules, Redirect Rules, Create rule, "Single redirect". Quando o hostname for igual a
   `www.selucra.com.br`, redirecionar (301, mantendo a query string) para o URL dinâmico `concat("https://selucra.com.br", http.request.uri.path)`.
6. **Web Analytics.** Cloudflare, Analytics & Logs, Web Analytics, Add a site, hostname `selucra.com.br`, opção "JavaScript snippet".
   Copie só o `token` (32 caracteres) de `data-cf-beacon` e guarde na variável do passo 3. Não ative também a injeção automática
   do Pages (contaria cada visita duas vezes). Faça um novo deploy depois de criar a variável.
7. **HTTPS.** SSL/TLS em Full (strict) e "Always Use HTTPS" ligado. O `_headers` já manda HSTS de 1 ano com `includeSubDomains`,
   então `app.` e `api.` precisam ter HTTPS válido antes do primeiro acesso.
8. **Conferir depois do deploy:**
    - `curl -I https://selucra.com.br` mostra `strict-transport-security`, `content-security-policy` e `x-content-type-options`.
    - `curl -I https://www.selucra.com.br` devolve 301 para `https://selucra.com.br/`.
    - `https://selucra.com.br/robots.txt`, `/sitemap.xml` e `/aprender/` respondem 200.
    - Em Web Analytics, a primeira visita aparece em alguns minutos.
    - Rich Results Test (search.google.com/test/rich-results) na home e nos guias: `FAQPage` e `Article` sem erro.
    - Search Console: propriedade de domínio (registro TXT no DNS), enviar `https://selucra.com.br/sitemap.xml`.
9. **Rollback.** Deployments, escolha o deploy anterior, Rollback to this deployment.

O app em `app.selucra.com.br` é outro projeto do Pages (LW.3.16); a landing não depende dele para ser publicada.

## Estrutura

- `src/index.html`: conteúdo (placeholders `{{...}}` preenchidos no build). O FAQ visível gera o JSON-LD `FAQPage`.
- `src/styles.css`: tokens de `.claude/identidade-visual-tokens.md` (duplicados de `frontend/src/index.css`; mudou um, muda o outro).
- `src/main.js`: movimento (valor piscando, demo de ordem). `src/scene.js`: cena three.js, carregada por `import()` depois do `load`.
- `content/aprender/*.json` + `aprender.mjs`: guias evergreen (`/aprender/<slug>/`) e o hub `/aprender/`. Número regulatório nunca é digitado: entra por `{{fact:id}}`, lido de `backend/src/modules/lessons/domain/regulatoryFacts.ts` (o build precisa do repositório inteiro, não só de `landing/`). A build **falha** se o fato não existe, foi conferido só por trecho de busca ou tem mais de 12 meses, e cada guia lista as fontes. Para criar um guia: copie um JSON, escreva (cartão curto, sem travessão, sem preço) e rode `npm test`.
- `svg.mjs`: sparkline e mapa da trilha gerados no build (determinísticos, com altos e baixos).
- `src/static/`: favicon, ícones, `og-image.png`, `robots.txt`, `_headers`. O `sitemap.xml` é gerado no build. `src/article.html` é o molde dos guias (cabeçalho e rodapé são os da home).

## Cloudflare Pages

Diretório raiz `landing`, comando `npm run build`, saída `dist`. `www` redireciona para o domínio raiz (regra no Cloudflare).
