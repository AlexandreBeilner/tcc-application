# Checklist: contas, plataformas e segredos para produção (só web)

Criado em **2026-10-10**. É a parte **fora do código** do lançamento (`backlog-lancamento-web-pwa.md`, LW.3.x e LW.4.x), para o autor ir
organizando em paralelo ao desenvolvimento. Valores de preço são ordem de grandeza e **precisam ser conferidos nas páginas oficiais**
na hora de contratar (preços de nuvem mudaram várias vezes em 2026).

## 1. Desenho em uma tela

```
Usuário ──► Cloudflare (DNS + proxy + WAF)
              ├─ selucra.com.br, www ──► Cloudflare Pages, projeto `landing` (HTML estático, SEO)
              ├─ app.selucra.com.br ──► Cloudflare Pages, projeto `frontend` (SPA React + PWA)
              └─ api.selucra.com.br ──► VPS São Paulo (Docker Compose)
                                          Caddy (TLS) ──► backend (Node) ──► motor (Go)
                                                              │                 │
                                                           Postgres ◄───────────┘   Redis
                                          (rede interna; só 80/443 abertas no host)

GitHub Actions ─ constrói imagens por SHA ─► GHCR ─► VPS faz pull (deploy.sh, com backup e rollback)
VPS ─ dump diário criptografado ─► armazenamento externo (Backblaze B2 ou Cloudflare R2)
Serviços externos: Resend (e-mail) · RevenueCat + Stripe (assinatura) · Google (login)
```

## 2. Contas e plataformas a abrir

| # | Plataforma | Para quê | Custo (a conferir) | Bloqueia |
|---|---|---|---|---|
| 1 | **Registro.br** | domínio `selucra.com.br` (exige CPF/CNPJ do titular) | ~R$ 40 por ano | tudo |
| 2 | **Cloudflare** (gratuita) | DNS, proxy/WAF da API, Pages do frontend | R$ 0 | LW.3.2, LW.3.16 |
| 3 | **Provedor do VPS** com datacenter em São Paulo (Vultr é o candidato; Magalu Cloud a comparar) | roda backend, motor, Postgres, Redis, Caddy | US$ 12 a 24 por mês (VPS de 2 vCPU/4 GB) | LW.3.1 |
| 4 | **GitHub** (já existe) | repositório, Actions e **GHCR** (registro de imagens) | R$ 0 para o volume esperado | LW.3.13 |
| 5 | **Backblaze B2** ou **Cloudflare R2** | cópia externa dos backups criptografados | centavos por mês nesse volume | LW.3.12 |
| 6 | **Resend** | e-mail transacional (recuperação de senha, verificação) | plano gratuito no início | LW.3.6 |
| 7 | **Stripe** (Brasil) | cartão para a assinatura PRO, atrás do RevenueCat | taxa por transação, sem mensalidade | LW.4.1 |
| 8 | **RevenueCat** | camada única de assinatura e webhook | gratuito até um teto de receita (conferir) | LW.4.1 |
| 9 | **Google Cloud Console** (já existe o projeto OAuth) | login com Google em produção | R$ 0 | LW.3.2 |
| 10 | **Monitoramento externo** (ex.: UptimeRobot/Better Stack) e **erros** (ex.: Sentry, plano gratuito) | alerta de queda, `/health`, erros do frontend e backend | R$ 0 no início | LW.3.5 |
| 11 | **Contador** | nota fiscal e regime tributário (o Stripe não emite NF-e) | variável | LW.4.2 |

Não precisa de: Apple Developer, Google Play Console, conta macOS/CI de iOS (app adiado).

**Pessoa jurídica:** o Stripe no Brasil costuma exigir CPF ou CNPJ conforme o tipo de conta, e cobrança recorrente de forma habitual
tem consequência fiscal. Confirmar com o contador antes de ativar a cobrança (LW.4.2).

## 3. Configurações a fazer nas plataformas

- **Registro.br:** apontar os servidores de nome para a Cloudflare; ligar DNSSEC conforme a Cloudflare orientar.
- **Cloudflare:** registros `selucra.com.br` e `www` para o Pages da landing (`www` redireciona para o domínio raiz) e `app` para o Pages do app; `api` apontando para o IP do VPS (com proxy ligado, LW7); SSL em
  "Full (strict)"; regras de WAF e limitação de taxa básicas; registros do Resend (SPF, DKIM, DMARC) **sem proxy**.
- **VPS:** região São Paulo, Ubuntu LTS, IP fixo, backup/snapshot semanal do provedor ligado, chave SSH cadastrada (sem senha).
- **Cloudflare Web Analytics (landing):** modo automático (ativar no projeto `landing` do Pages ou no hostname `selucra.com.br`, nunca na zona inteira, para o app e a API ficarem sem script) ou modo manual (copiar o `token` de 32 caracteres do snippet e criar `CF_ANALYTICS_TOKEN` no projeto). Usar só um dos dois, senão a visita conta em dobro. O token não é segredo.
- **Google OAuth:** tela de consentimento em "Em produção", domínio autorizado `selucra.com.br`, URL da política de privacidade
  (`/privacidade`), origem `https://app.selucra.com.br` e redirecionamento `https://api.selucra.com.br/auth/google/callback`.
- **Resend:** domínio verificado, chave de API de envio, webhook assinado apontando para `https://api.selucra.com.br/webhooks/...`
  (conferir a rota em `.docs/backend/notifications.md`).
- **Stripe + RevenueCat:** integração Stripe Billing conectada ao projeto do RevenueCat, produtos mensal e anual (R$ 9,90 e R$ 89,90),
  Offering `default`, entitlement `pro`, webhook do RevenueCat com cabeçalho `Authorization` secreto apontando para o backend.
- **GitHub:** pacote GHCR privado, secrets do Actions (chave SSH de deploy, se o deploy for automático), proteção da `main`.

**Staging (LW.3.7b):** `staging.selucra.com.br` (frontend, branch `staging` do Pages) e `api-staging.selucra.com.br` (API, mesmo VPS, outro projeto do Compose). Registros DNS a mais na Cloudflare (`staging` e `api-staging`, este com proxy), Cloudflare Access fechando o acesso, segredos próprios (nada reaproveitado de produção), RevenueCat/Stripe em sandbox e cliente OAuth do Google com o redirecionamento do staging.

## 4. Segredos e variáveis (lista completa do que produção precisa)

Gerar **todos** com `openssl rand -base64 48` (ou gerenciador de senhas) e guardar duas cópias: gerenciador de senhas e o `.env` do servidor
(modo 600, nunca no git). Quem perder o `.env` perde o acesso a tudo, então a cópia fora do servidor é obrigatória.

**Servidor (`.env`, lido pelo compose de produção)**

| Variável | Origem | Observação |
|---|---|---|
| `DEPLOY_ENV=production` | fixo | liga a guarda da LW.3.8 |
| `POSTGRES_PASSWORD` | gerada | superusuário só de administração; 16+ caracteres |
| senhas dos papéis `gamification_app`, `market_app` | geradas | LW.3.17 |
| `REDIS_PASSWORD` | gerada | LW.3.7 |
| `JWT_SECRET` | gerada, 32+ caracteres | girar invalida os logins ativos |
| `EMAIL_UNSUBSCRIBE_SECRET` | gerada (ou vazio) | vazio reaproveita o `JWT_SECRET` |
| `SIMULATION_SEED` | número fixo | **nunca mudar depois do primeiro dia** (RNF08) |
| `FRONTEND_URL`, `PUBLIC_API_URL` | `https://app.selucra.com.br`, `https://api.selucra.com.br` | `FRONTEND_URL` é a origem do app (CORS, links de e-mail), não a da landing |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` | Google Cloud Console | |
| `EMAIL_PROVIDER=resend`, `RESEND_API_KEY_TRANSACTIONAL`, `RESEND_API_KEY_NEWS`, `RESEND_WEBHOOK_SECRET`, `EMAIL_FROM_TRANSACTIONAL`, `EMAIL_FROM_NEWS`, `EMAIL_REPLY_TO` | Resend | duas chaves (subdomínios `send` e `news`); remetentes `no-reply@send.` e `no-reply@news.selucra.com.br`; reply-to `suporte@selucra.com.br` |
| `BILLING_PROVIDER=revenuecat`, `REVENUECAT_SECRET_KEY` (sk_...), `REVENUECAT_WEBHOOK_AUTH`, `REVENUECAT_ENTITLEMENT_ID=pro` | RevenueCat | |
| `BILLING_PRICE_MONTHLY_CENTS`, `BILLING_PRICE_ANNUAL_CENTS` | 990 e 8990 | só exibição; o preço real vive na loja/Stripe |
| `TICK_SCHEDULER_ENABLED`, `SCHEDULER_TIMEZONE` | motor | padrão `America/Sao_Paulo`; só definir se precisar mudar |
| chave de criptografia dos backups (`age`) | gerada | **guardar a chave privada fora do servidor**: sem ela o backup não abre |
| credenciais do armazenamento externo (B2/R2) | provedor | permissão só de escrita para o servidor, se possível |

**Frontend (Cloudflare Pages, embutidas no build)**

| Variável | Origem |
|---|---|
| `VITE_GATEWAY_URL` | `https://api.selucra.com.br` |
| `VITE_REVENUECAT_WEB_PUBLIC_KEY` | RevenueCat (chave pública da web, não é segredo) |

**CI (GitHub Actions)**: `GITHUB_TOKEN` já basta para publicar no GHCR; chave SSH de deploy só se o deploy for disparado pelo Actions.

**Segredo que nunca vai para variável de ambiente:** a senha do usuário admin da aplicação (LW.3.17), digitada só no terminal.

## 5. Ordem prática para ir organizando

1. Registrar `selucra.com.br` e abrir a Cloudflare (leva dias para propagar).
2. Escolher o provedor do VPS e criar um **VPS de teste** para eu medir o consumo real e ensaiar o deploy (LW.3.1).
3. Abrir Resend e verificar o domínio (a reputação do domínio de e-mail leva tempo para amadurecer).
4. Abrir Stripe e RevenueCat em modo de teste (não exige CNPJ até cobrar de verdade) e criar os produtos.
5. Conversar com o contador sobre a emissão de nota e o regime (pode atrasar tudo se deixar para o fim).
6. Preencher os `[PREENCHER ...]` da política de privacidade (`.claude/politica-privacidade-placeholders.md`), que o Google e as lojas exigem pública.
7. Criar o gerenciador de senhas compartilhável e gerar os segredos da seção 4.

## 6. Custo mensal estimado (a conferir)

| Item | Estimativa |
|---|---|
| VPS em São Paulo | R$ 70 a 140 |
| Domínio (rateado) | ~R$ 4 |
| Backup externo, Cloudflare, GHCR, Resend, monitoramento | R$ 0 a 20 |
| Stripe | só por transação |
| **Total** | **R$ 80 a 170**, dentro do teto de R$ 200 |
