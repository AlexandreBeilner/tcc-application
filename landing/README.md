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
`CF_ANALYTICS_TOKEN` existe no build. Sem ela, o build não coloca nada no HTML (é o caso do `npm run dev`); o Web Analytics ainda pode ser ligado no modo automático da Cloudflare, sem token. O token tem 32 caracteres, aparece no
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
    - `CF_ANALYTICS_TOKEN` = o token do Web Analytics (passo 6, só no modo manual). Opcional: sem ele, o build não coloca nenhum script.
    - `API_URL` só se a API não for `https://api.selucra.com.br` (a página `/diario/` chama `GET /daily/*` nessa origem; em staging, aponte para a API de staging).
    - `SITE_URL` e `APP_URL` só se forem diferentes de `https://selucra.com.br` e `https://app.selucra.com.br` (o padrão já é produção).
4. **Build watch paths** (projeto, Settings, Build, Build watch paths). Em monorepo o Pages rebuilda a cada commit em qualquer pasta;
   o filtro evita isso. Em **Include paths**, duas linhas: `landing/*` e
   `backend/src/modules/lessons/domain/regulatoryFacts.ts`. Deixe **Exclude paths** vazio.
    - Commit só em `frontend/`, `engine/` ou no resto do `backend/` não gera deploy da landing.
    - Commit que muda um fato regulatório gera deploy, porque os guias usam os números dele.
    - Para publicar sem mudar esses arquivos: Deployments, Retry deployment (ou Create deployment).
    - O Pages não percebe sozinho um fato que passou de 12 meses; quem avisa é o `landing-ci.yml`, que roda toda segunda-feira.
5. **Domínios.**
    - **Ligar ao projeto:** aba Custom domains, Set up a custom domain, `selucra.com.br`, Continue, Activate domain. A Cloudflare cria o
      CNAME do `@` para `selucra-landing.pages.dev`, com proxy ligado. Repita com `www.selucra.com.br` e espere os dois ficarem
      Active (alguns minutos, enquanto o certificado é emitido). Se der erro de registro DNS já existente, apague o registro antigo do
      `@` ou do `www` (por exemplo, um estacionamento do Registro.br) na aba DNS da zona e tente de novo.
    - **Redirecionar o www para o domínio raiz** (na zona `selucra.com.br`, não no projeto): Rules, Redirect Rules, Create rule. Se
      houver o modelo "Redirect from WWW to root", use-o. Senão: nome `www para raiz`; When incoming requests match, Custom filter
      expression, Hostname equals `www.selucra.com.br`; Then, Type Dynamic, Expression
      `concat("https://selucra.com.br", http.request.uri.path)`, Status code 301, marque Preserve query string; Deploy.
    - **Conferir:** `curl -I https://www.selucra.com.br/aprender/` deve devolver `301` e `location: https://selucra.com.br/aprender/`.
      O registro do `www` precisa estar com a nuvem laranja (proxy ligado), o que o passo de ligar o domínio já faz.
6. **Web Analytics.** Use **só um** dos dois modos (os dois juntos contam cada visita em dobro):
    - **Automático (mais simples):** no projeto da landing, Metrics ou Web Analytics, Enable. Se não achar, Analytics & Logs, Web
      Analytics, adicione `selucra.com.br` com a configuração automática. A Cloudflare injeta o script na entrega, sem token e sem
      variável. Ative **só para a landing** (projeto ou hostname `selucra.com.br`), nunca para a zona inteira: senão o script também
      iria para `app.selucra.com.br` e para a API, e a política de privacidade diz que o app não tem analytics.
    - **Manual:** Analytics & Logs, Web Analytics, Add a site, hostname `selucra.com.br`, opção "JavaScript snippet". Copie só o
      `token` (32 caracteres) de `data-cf-beacon`, guarde na variável `CF_ANALYTICS_TOKEN` do passo 3 e faça um novo deploy.
      A CSP do `_headers` já libera `static.cloudflareinsights.com` e `cloudflareinsights.com` nos dois modos.
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

## Arquivo do Diário (DI.3.4)

`/diario/arquivo/` (índice) e `/diario/arquivo/<n>/` (um jogo encerrado: palavra e pergunta com a resposta) são gerados
no build por `diarioArquivo.mjs`, a partir de `GET /daily/archive` da API (`API_URL`). O jogo do dia nunca entra: a API só devolve jogo
encerrado e o build filtra de novo pela data (UTC).

- **API fora no build:** o build não falha. Ele lê o `diario/arquivo/jogos.json` do deploy anterior (publicado junto das páginas) e, se nem
  isso existir, segue sem arquivo e avisa no log. Enquanto não há jogo encerrado (antes da estreia e no dia dela), nenhuma página do arquivo é
  criada, nem o bloco "Dias anteriores" na página do Diário.
- **Build diário:** o workflow `.github/workflows/diario-arquivo.yml` dispara o deploy da landing todo dia às 00:10 UTC (21:10 de Brasília),
  logo depois de o jogo do dia anterior encerrar. Ele usa o segredo `CF_PAGES_DEPLOY_HOOK_LANDING` (sem o segredo, só avisa).
  Para criar: Cloudflare, projeto `selucra-landing`, Settings, Builds, **Deploy hooks**, Add (branch `main`), copie a URL; no GitHub,
  Settings, Secrets and variables, Actions, New repository secret, nome `CF_PAGES_DEPLOY_HOOK_LANDING`. Teste com Actions, "Arquivo do
  Diário", Run workflow.
- **Texto da API é tratado como não confiável:** escapado no HTML, e o `<` vira `\u003c` no JSON-LD.

## Estrutura

- `src/index.html`: conteúdo (placeholders `{{...}}` preenchidos no build). O FAQ visível gera o JSON-LD `FAQPage`.
- `src/styles.css`: tokens de `.claude/identidade-visual-tokens.md` (duplicados de `frontend/src/index.css`; mudou um, muda o outro).
- `src/main.js`: movimento (valor piscando, demo de ordem). `src/scene.js`: cena three.js, carregada por `import()` depois do `load`.
- `content/aprender/*.json` + `aprender.mjs`: guias evergreen (`/aprender/<slug>/`) e o hub `/aprender/`. Número regulatório nunca é digitado: entra por `{{fact:id}}`, lido de `backend/src/modules/lessons/domain/regulatoryFacts.ts` (o build precisa do repositório inteiro, não só de `landing/`). A build **falha** se o fato não existe, foi conferido só por trecho de busca ou tem mais de 12 meses, e cada guia lista as fontes. Para criar um guia: copie um JSON, escreva (cartão curto, sem travessão, sem preço) e rode `npm test`.
- `src/diario.html` + `src/diario-page.ts`: página `/diario/` (Diário Selucra). O conteúdo para busca está no HTML; o jogo é o módulo `src/diario/` montado em modo `publico` por um bundle próprio (sem a cena 3D). O convite para o app ao terminar já está no HTML, escondido, e o script o mostra. Variável de build `API_URL`.
- `diarioArquivo.mjs`: arquivo público dos jogos encerrados (dados, páginas, JSON-LD, sitemap).
- `svg.mjs`: sparkline e mapa da trilha gerados no build (determinísticos, com altos e baixos).
- `src/static/`: favicon, ícones, `og-image.png`, `robots.txt`, `_headers`. O `sitemap.xml` é gerado no build. `src/article.html` é o molde dos guias (cabeçalho e rodapé são os da home).

## Cloudflare Pages

Diretório raiz `landing`, comando `npm run build`, saída `dist`. `www` redireciona para o domínio raiz (regra no Cloudflare).
