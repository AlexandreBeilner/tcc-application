# Selucra: frontend (app)

SPA React (Vite) servida em `https://app.selucra.com.br` pelo Cloudflare Pages. O site de apresentação é outro projeto (`landing/`,
em `selucra.com.br`). O frontend não tem Dockerfile: o build gera arquivos estáticos em `dist/`.

## Variáveis de ambiente

O Vite só expõe ao navegador as variáveis que começam com `VITE_`, e **troca cada uma pelo valor literal na hora do build**
(`npm run build`). Por isso:

- **Mudar o valor exige novo build e novo deploy.** Alterar a variável no painel não muda o site que já está no ar.
- **Nada secreto aqui.** Quem abrir o site vê o valor no JavaScript. Segredos (`JWT_SECRET`, chaves do Resend) ficam só no
  backend, no VPS.
- Variável sem o prefixo `VITE_` não chega ao navegador (de propósito).

| Variável           | Em desenvolvimento                                                                                                              | Em produção (`app.selucra.com.br`) | Observação                                                                                                                                                                          |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `VITE_GATEWAY_URL` | Não definir: o cliente usa caminho relativo e cai no proxy do Vite (`vite.config.ts`), que aponta para `http://localhost:8000`. | `https://api.selucra.com.br`       | Obrigatória no build de produção. Sem ela, o app chama a própria origem e nada funciona. O CORS do backend (`FRONTEND_URL=https://app.selucra.com.br`) precisa aceitar essa origem. |

`frontend/.env.local` fica só no seu computador (o `.gitignore` da raiz o exclui) e **nunca é lido pela Cloudflare**: em produção
vale o que estiver nas variáveis do projeto do Pages.

## Publicar no Cloudflare Pages

Pré-requisitos: zona `selucra.com.br` ativa na Cloudflare e a API no ar em `api.selucra.com.br` (LW.3.1 e LW.3.7 do
`.claude/backlog-lancamento-web-pwa.md`). Sem a API, o app abre mas login, trilha e mercado não carregam.

1. **Projeto.** Workers & Pages, Create, aba **Pages**, Connect to Git, o mesmo repositório. Nome: `selucra-app`. Branch de produção:
   `main`.
2. **Build.** Framework preset: None. Root directory: `frontend`. Build command: `npm ci && npm run build`. Output: `dist`.
3. **Variáveis** (Settings, Variables and secrets):
    - **Production:** `NODE_VERSION` = `22`, `VITE_GATEWAY_URL` = `https://api.selucra.com.br`.
    - **Preview** (pull requests e outras branches): as mesmas, mas com `VITE_GATEWAY_URL` apontando para o staging
      (`https://api-staging.selucra.com.br`, LW.3.7b).
    - Cada alteração só vale a partir do deploy seguinte: Deployments, Retry deployment.
4. **Build watch paths** (Settings, Build): Include `frontend/*`. Assim, commits só no backend, no motor ou na landing não geram deploy
   do app.
5. **Domínio.** Custom domains, Set up a custom domain, `app.selucra.com.br`, Activate domain. A Cloudflare cria o CNAME (com proxy)
   sozinha.
6. **Conferir.** Abra `https://app.selucra.com.br`, o DevTools (aba Network) deve mostrar as chamadas indo para
   `https://api.selucra.com.br`, sem erro de CORS. Dê F5 numa rota interna (por exemplo `/mercado`): não pode dar 404.
7. **Rollback.** Deployments, escolha o deploy anterior, Rollback to this deployment.

### O que já existe e o que ainda falta no código (LW.3.16)

- **Já existe** (entrou com o PWA, LW.2.2): `frontend/public/_redirects` com o fallback da SPA (`/* /index.html 200`; sem ele, F5 numa rota
  interna dá 404 no Pages) e `frontend/public/_headers` com `no-cache` em `sw.js`, `manifest.webmanifest` e `offline.html`, cache longo
  só em `/assets/*` (arquivos com hash) e `X-Robots-Tag: noindex, nofollow`.
- **Falta:** a CSP no `_headers` (Stripe e RevenueCat; cuidado com o `connect-src` da API e do `worker-src 'self'` do service worker),
  e atualizar na API os valores de produção (`FRONTEND_URL`, `PUBLIC_API_URL`) e a origem do Google OAuth (LW.3.2).

---

# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
    "$schema": "./node_modules/oxlint/configuration_schema.json",
    "plugins": ["react", "typescript", "oxc"],
    "options": {
        "typeAware": true
    },
    "rules": {
        "react/rules-of-hooks": "error",
        "react/only-export-components": ["warn", { "allowConstantExport": true }]
    }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.
