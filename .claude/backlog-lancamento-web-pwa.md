# Backlog — Lançamento só na web, com foco em PWA

Criado em **2026-10-10**. O autor decidiu **lançar apenas na web** para validar tração e **adiar o app
mobile** (custo de contas Apple/Google, comissão das lojas, CI macOS). O PWA (a própria web instalável
na tela inicial) é a presença "mobile" por enquanto. Este arquivo reúne tudo que falta para publicar
só na web; o que é específico do app nativo continua nos backlogs próprios, **congelado**.

## Decisões fechadas (2026-10-10)

| # | Decisão |
|---|---|
| LW1 | **Lançamento só na web.** Android e iOS nativos ficam adiados; `mobile/` permanece no repositório, sem evolução e sem build. |
| LW2 | **RevenueCat continua** como camada única de assinatura, só com o checkout web (Stripe conectado, decisão M12). Revisitar a troca por Stripe direto só se o custo mensal do RevenueCat incomodar. |
| LW3 | **PWA é o canal mobile por enquanto.** Instalável, com atualização controlada e página offline; dados vivos (mercado, ranking, assinatura) nunca vêm do cache. |
| LW4 | O código específico do app (`isNativeApp`, ponte de compra nativa, `POST /auth/google/native`, avisos de "assinatura em outra plataforma") **fica no repositório e inerte na web**, com testes cobrindo o caminho web. Não remover. |
| LW6 | **Em produção o Caddy faz o papel do gateway** (aprovado em 2026-10-10): termina o TLS e repassa direto ao backend; o nginx de `gateway/` fica no repositório só para o desenvolvimento. Desvio consciente da spec seção 3 (o papel de porta de entrada única continua, muda a peça). |
| LW7 | **Cloudflare na frente da API** (aprovado em 2026-10-10): proteção contra abuso e DDoS grátis. Cadeia de produção: Cloudflare, Caddy, backend (2 saltos de proxy), com o IP real vindo de `CF-Connecting-IP`; ajuste do `trust proxy` e do Caddy na LW.3.9. |
| LW8 | **Sem Web Push por agora** (2026-10-10). O PWA não pede permissão de notificação e o service worker não trata evento `push`. Reengajamento só por e-mail. |
| LW5 | O aviso "App Android e iOS em breve" é só texto (mais captação opcional de e-mail). Convite, nunca escassez (M6). |

## Como usar este arquivo

Mesma disciplina dos outros backlogs: uma tarefa por sessão, ✅ + bullet de Entregável ao concluir,
critérios de aceite antes de marcar. Tarefa que toca `backend/` segue o checklist inteiro do
`CLAUDE.md`. **Toda tela e todo ajuste visual nascem nos três breakpoints** e passam pelo
`identidade-visual-padroes.md`. Antes de implementar PWA, **confira a documentação atual** de
Workbox/`vite-plugin-pwa`, do Chrome (instalabilidade) e do WebKit (PWA no iOS): os requisitos mudam.

---

## Fase 1 — Congelar o mobile e deixar a web autossuficiente

### LW.1.1 · Registrar o adiamento nos documentos ✅ (2026-10-10)
- **Entregável:** avisos de "adiado" em `backlog-app-mobile.md`, `arquitetura-app-mobile-react-native-webview.md`, `backlog-monetizacao.md` (M2 revisada, Fase D e MO.4.4), `backlog-pendencias-consolidado.md` e `CLAUDE.md`; este backlog criado.

### LW.1.2 · "App em breve" na web ✅ (2026-10-12)
- **Descrição:** comunicar que o app nativo vem depois, sem prometer data, e apontar o PWA como alternativa agora.
- **O que fazer:** texto curto no rodapé/landing e em `/planos` ("App Android e iOS em breve. Por enquanto, instale a Selucra na tela inicial"). Opcional: campo "avise-me" que grava e-mail numa tabela nova (módulo próprio no backend, com Zod, teste e `.docs/backend/`), com consentimento explícito e descadastro (reaproveitar o fluxo da EM.6.1). Decidir antes com o autor se a captação entra.
- **Aceite:** o aviso aparece nos três breakpoints, sem link quebrado para loja; sem o campo, nenhuma chamada nova ao backend.
- **Dependências:** LW.2.4 (o texto aponta para a instalação do PWA).
- **Entregável:** aviso no fim de `/planos` (`pages/Planos`): "App Android e iOS em breve", sem data e sem link de loja; quando o navegador permite instalar (`useInstallMode` diferente de `none`), acrescenta "Por enquanto, instale a Selucra na tela inicial" levando a `/configuracoes`, onde está o convite. Não aparece dentro do app nativo (`isNativeApp()`). **Sem campo "avise-me":** a captação de e-mail ficou fora, então nenhuma chamada nova ao backend (decisão a confirmar com o autor se quiser a captação). Landing não foi alterada. Testes na tela (2).

### LW.1.3 · Garantir que o código de app não vaza na web ✅ (2026-10-12)
- **Descrição:** `isNativeApp()` deve ser `false` no navegador e no PWA instalado (o PWA **não** é o app).
- **O que fazer:** teste cobrindo `describePlan`, `useWebPurchases`, `Planos`, `PlanSection` e `ProInvite` no navegador e com `display-mode: standalone`; conferir que nenhum caminho oferece "Restaurar compras" nem link de loja na web.
- **Aceite:** testes novos passando; nenhuma tela web menciona App Store ou Google Play, salvo o aviso da LW.1.2.
- **Dependências:** nenhuma.
- **Entregável:** `features/billing/isNativeApp/index.test.ts` (falso no navegador e no `display-mode: standalone`, verdadeiro só com `ReactNativeWebView`) e `pages/Planos/webOnly.test.tsx` (Planos para quem não assina, Planos para quem assina pela web e `PlanSection`, no navegador e com `standalone`, sem "App Store", "Google Play" nem "Restaurar compras"). Nenhum ajuste de código foi necessário: o caminho nativo já era isolado pela ponte do WebView.

---

## Fase 2 — PWA

Estado de partida (2026-10-10): existem `manifest.webmanifest` (nome, ícones 192/512 e maskable, `display: standalone`,
cores) e `apple-touch-icon`. **Não existe** service worker, página offline nem fluxo de instalação.

### LW.2.1 · Manifest completo e metadados de plataforma ✅ parcial (2026-10-12; faltam as capturas de tela)
- **O que fazer:** `id`, `scope`, `description`, `categories`, `orientation`, `shortcuts` (Mapa da Trilha, Carteira, Ranking), `screenshots` (mobile e desktop, exigidos pelo painel de instalação rico do Android); metas do iOS (`apple-mobile-web-app-capable`, título, estilo da status bar). **Corrigir o `viewport`:** `maximum-scale=1, user-scalable=no` bloqueia o zoom e é problema de acessibilidade (WCAG 1.4.4); remover e conferir que nenhum input dá zoom automático no iOS (fonte >= 16 px nos campos). Ajustar áreas seguras (`env(safe-area-inset-*)`) na `TopBar` e na `TabBar` inferior.
- **Aceite:** Lighthouse/DevTools "Installability" sem avisos; zoom por pinça funciona; barra inferior não é coberta pela barra de gestos do iOS.
- **Dependências:** nenhuma.
- **Entregável:** `manifest.webmanifest` com `id`, `scope`, `description`, `categories`, `orientation`, `launch_handler` (link de e-mail reaproveita a janela aberta) e 3 `shortcuts` (Trilha, Portfólio, Ranking, com `?source=` para distinguir a origem). `index.html`: metas do iOS (`apple-mobile-web-app-capable`, título, `status-bar-style: black`), `mobile-web-app-capable` e `viewport-fit=cover`; o viewport **já não tinha** `maximum-scale`/`user-scalable=no` (conferido). Áreas seguras: `TopBar` (topo, laterais), `TabBar` mobile (base) e `padding-bottom` do conteúdo; `100dvh` no shell e no `body`. Campos com `font-size` abaixo de 16 px passam a 16 px abaixo de 768 px (evita o zoom automático do iOS). `theme-color` acompanha o tema (`ThemeContext`). **Pendente:** `screenshots` do manifest (exigem o app logado com dados reais; capturar mobile e desktop em staging) e conferir o item "Installability" no DevTools com HTTPS real.

### LW.2.2 · Service worker com cache seguro (`vite-plugin-pwa`/Workbox) ✅ (2026-10-12)
- **O que fazer:** pré-cache do app shell (JS/CSS/ícones com hash); fontes em cache de runtime. **Regras invioláveis:** nunca guardar em cache respostas de `/auth`, `/me`, `/billing`, `/market`, `/ranking`, `/friendships`, `/admin` nem qualquer chamada de API (dado financeiro desatualizado é pior que erro; RNF09 e o gating do PRO dependem de resposta fresca); navegação cai no `index.html` com exceção das rotas de backend que colidem (`/auth/callback`, `/admin/*`, ver `vite.config.ts`). `sw.js` servido sem cache longo. **Atualização controlada:** ao detectar versão nova, mostrar aviso "Nova versão disponível, atualizar" em vez de recarregar no meio de uma lição ou de uma ordem; limpar caches antigos.
- **Aceite:** após um deploy, quem tem o app aberto vê o aviso e atualiza com um toque; auditoria confirma que nenhuma resposta de API fica no cache; teste manual com rede cortada.
- **Dependências:** LW.2.1.
- **Entregável:** `vite-plugin-pwa@2.0.0` em modo `injectManifest` com `src/sw/sw.ts` próprio (workbox-precaching e workbox-routing). **Pré-cache** só do app shell: JS e CSS com hash (inclusive os chunks de rota), fonte latina, ícones e `offline.html`; ficam fora o `index.html`, o chunk do SDK do RevenueCat (932 KB, só em `/planos`), o painel admin e a fonte `latin-ext`. **Nenhuma rota de runtime**: nada de `/auth`, `/me`, `/billing`, `/market`, `/ranking`, `/friendships`, `/admin` nem da origem da API é guardado (verificado no Cache Storage de um Chrome real: só 11 arquivos do shell). **Atualização controlada:** `features/pwa/serviceWorker` (workbox-window) registra só em produção, procura versão nova a cada hora e ao voltar ao primeiro plano; a versão nova espera (`waiting`) e `UpdateNotice` mostra "Nova versão disponível" com o botão Atualizar, que manda `SKIP_WAITING` e só então recarrega (nunca no meio de lição ou ordem); caches antigos são limpos. `public/_headers` põe `Cache-Control: no-cache` em `sw.js`, `manifest.webmanifest` e `offline.html`, `immutable` em `/assets/*` e `X-Robots-Tag: noindex`; `public/_redirects` traz o fallback da SPA. `tsconfig.sw.json` tipa o worker. **Validado num Chrome real (Playwright) contra `vite preview`:** instalação e controle da página, 2º build publicado, aviso visível sem recarregar sozinho, clique em Atualizar troca o bundle e remove os arquivos da versão antiga do cache. Testes: store, registro (mock do workbox-window, inclusive "não recarrega na primeira instalação") e `UpdateNotice`.

### LW.2.3 · Experiência offline ✅ (2026-10-12)
- **O que fazer:** página offline nativa da marca (substitui o erro do navegador): "Sem conexão. A Selucra precisa de internet para mostrar o mercado". O mercado é simulação viva, então **não há modo offline de dados** (decisão do arquivo do app, seção 1, vale aqui). Leitura de lição já aberta fica fora desta tarefa.
- **Aceite:** abrir o app instalado sem rede mostra a página offline com botão "Tentar de novo"; ao voltar a rede, volta sozinho.
- **Dependências:** LW.2.2.
- **Entregável:** `public/offline.html` (marca, tema claro/escuro por `prefers-color-scheme`, "Tentar de novo" com alvo de 44 px, volta sozinha no evento `online`). A navegação do service worker vai sempre à rede primeiro e só cai nessa página se falhar. Validado no Chrome real com a rede cortada: "Sem conexão" no lugar do erro do navegador, e o botão volta ao app com a rede de volta. Observação: o evento `online` não é emitido pela emulação do DevTools/Playwright, então o recarregamento automático foi coberto só pelo botão; conferir num aparelho real.

### LW.2.4 · Fluxo de instalação ✅ parcial (2026-10-12; falta o evento de funil)
- **O que fazer:** Android/Chrome: capturar `beforeinstallprompt`, guardar o evento e oferecer "Instalar" num ponto natural (depois da primeira lição concluída, e em Configurações), nunca em popup na entrada. iOS/Safari: não existe o evento, então mostrar instrução ilustrada ("Compartilhar, Adicionar à Tela de Início") detectando iOS e navegador fora do modo instalado. Dispensar com memória local (`localStorage` com try/catch). Convite, nunca insistência (M6). Evento de funil "instalou" (`appinstalled`) no mesmo padrão do funil da MO.7.1, sem dado pessoal.
- **Aceite:** instala e abre em janela própria no Android, no desktop (Chrome/Edge) e, manualmente, no iOS; o convite some depois de instalado.
- **Dependências:** LW.2.1, LW.2.2.
- **Entregável:** `features/pwa/install` (captura `beforeinstallprompt` e `appinstalled`, `isStandalone`, detecção do Safari do iPhone/iPad incluindo o iPadOS que se apresenta como Mac, convite dispensado por 30 dias em `localStorage` com try/catch) e `components/molecules/InstallInvite`: botão "Instalar" (diálogo do navegador) no Android e no desktop, passo a passo ilustrado em texto no Safari do iPhone, nada em outros navegadores e some depois de instalado. Aparece em Configurações (sempre, sem dispensar) e na Trilha depois da primeira lição concluída (dispensável, "Agora não"). Nunca em popup na entrada. Testes: detecção de plataforma, estado, dispensa e componente. **Pendente (decisão do autor):** o evento de funil "instalou" (`appinstalled`) exige mexer no módulo `billing` (constraint `funnel_events_name_chk`, migração, métricas do painel) para medir algo que não é do funil do PRO; ficou de fora e vale decidir se compensa ou se basta o Cloudflare Web Analytics.

### LW.2.5 · Fontes locais (sem Google Fonts) ✅ (2026-10-12)
- **Descrição:** hoje `index.html` carrega Inter/Sora do Google Fonts. Sem rede de terceiros no caminho crítico o app fica offline-capaz e deixa de enviar o IP do usuário ao Google antes do consentimento (LGPD).
- **O que fazer:** hospedar Inter e Sora no próprio build (subset latino), `font-display: swap`, pré-carregar só as variações usadas; remover os `preconnect` e atualizar a política de privacidade (cookies/armazenamento).
- **Aceite:** nenhuma requisição a `fonts.googleapis.com`/`gstatic` na aba Rede; fontes funcionam offline pelo service worker.
- **Dependências:** LW.2.2.
- **Entregável:** Inter e Sora variáveis (subsets `latin` e `latin-ext`, OFL, licenças em `src/assets/fonts/`) em `src/fonts.css` com `font-display: swap` e os mesmos nomes de família dos tokens; `index.html` sem `preconnect` nem folha do Google. `latin-ext` só baixa quando um caractere raro aparece; a fonte latina entra no pré-cache. Conferido no Chrome real: **0 requisições** a `googleapis`/`gstatic`. Política de privacidade (seção 6) atualizada com as fontes próprias e o que o PWA guarda no aparelho; data de atualização passou para 12/10/2026.

### LW.2.6 · Fluxos críticos dentro do PWA instalado
- **Descrição:** o modo `standalone` muda o comportamento de redirecionamentos externos, justo onde a Selucra depende deles.
- **O que testar/ajustar:** login Google web (redirecionamento ao Google e volta por `/auth/callback`, que precisa cair dentro do escopo do PWA e não abrir o navegador); checkout do Stripe pelo RevenueCat e o retorno em `/planos`; links de e-mail (recuperação de senha, verificação) abrindo no PWA instalado no Android e **no Safari** no iOS (iOS não entrega link ao PWA); botão voltar do Android; compartilhamento da retrospectiva (Web Share API com fallback de copiar link/baixar imagem).
- **Aceite:** roteiro executado no Android (Chrome), no iPhone (Safari, PWA instalado) e no desktop, com resultado registrado aqui; cada falha vira ajuste ou item em `pontos-em-aberto-decisao-produto.md`.
- **Dependências:** LW.2.4.

### LW.2.6 (andamento 2026-10-12) · O que já foi conferido no código e o roteiro manual
- **Estado:** a tarefa continua aberta: ela exige HTTPS real e aparelhos (Android/Chrome, iPhone/Safari com o PWA instalado, desktop). O que dava para verificar sem aparelho foi feito.
- **Conferido no código:** (1) o `/auth/callback` fica dentro do escopo do PWA (`scope: "/"`), e a API em `api.selucra.com.br` é outra origem, então o login Google sai do escopo e volta por redirecionamento do backend (`FRONTEND_URL/auth/callback#token=`), comportamento esperado no Chrome Android (aba personalizada que fecha ao voltar ao escopo), **a confirmar no aparelho**; (2) o compartilhamento da retrospectiva já usa `navigator.canShare({ files })` com fallback para baixar o PNG, e o convite usa `navigator.share` com cópia do link como alternativa; (3) `launch_handler: navigate-existing` faz o link de e-mail aberto no Android reaproveitar a janela do app; (4) o botão voltar do Android usa o histórico do React Router e sai do app na raiz.
- **Limitações conhecidas do iOS (não têm correção no código):** o PWA instalado guarda o próprio `localStorage`, separado do Safari, então quem entra pelo Safari precisa entrar de novo no app instalado; links de e-mail (recuperação de senha, verificação) sempre abrem no Safari, e a pessoa volta ao app instalado manualmente; o redirecionamento do Google pode terminar numa tela de navegador em vez de voltar ao PWA. Se o roteiro confirmar o último ponto, o caminho é oferecer "Entrar com e-mail e senha" em destaque dentro do app instalado no iPhone.
- **Roteiro (registrar o resultado aqui por aparelho):** instalar; abrir pelo ícone; entrar com e-mail e senha; entrar com Google (ida e volta); concluir uma lição; comprar um ativo; abrir `/planos`, iniciar e concluir o checkout com cartão de teste e conferir o retorno em `/planos`; abrir um link de recuperação de senha e um de verificação vindos do e-mail; compartilhar a retrospectiva e o convite; cortar a rede e abrir o app (página offline); publicar uma versão nova e ver o aviso "Atualizar"; botão voltar do Android; girar o aparelho; barra inferior sem ficar sob a barra de gestos.

### LW.2.7 · Web Push ⏸ ADIADO (decisão do autor, 2026-10-10: sem push notifications por agora)
- **Estado:** fora do lançamento. Não abrir tarefa nem criar tabela de inscrições, chaves VAPID ou handler `push` no service worker. O e-mail (resumo semanal, lembrete de sequência, opt-in) continua sendo o único canal de reengajamento. Reabrir só com dado de retenção que justifique. O texto abaixo fica como referência.
- **Descrição:** é o recurso do app nativo que o PWA também cobre (lembrete de streak, evento macro, fim de duelo). No iOS só funciona com o PWA instalado e a partir do iOS 16.4.
- **Decisão do autor pendente:** entra no lançamento ou depois da validação? Se entrar: chaves VAPID, tabela de inscrições, caso de uso e preferências no módulo `notifications` (opt-in explícito, mesma regra do e-mail de engajamento), envio pelo worker existente (outbox), limpeza de inscrição morta (410), conteúdo sem patrimônio absoluto (RNF09).
- **Aceite:** só abrir tarefa executável depois da decisão.
- **Dependências:** LW.2.2, LW.2.4.

### LW.2.8 · Auditoria final do PWA ✅ parcial (2026-10-12; falta medir em produção)
- **O que fazer:** Lighthouse mobile (PWA, desempenho, acessibilidade, melhores práticas) e correções; tamanho do bundle inicial (carregar telas por rota com `lazy`); `theme-color` e splash coerentes com os tokens escuro/claro.
- **Aceite:** metas registradas aqui (sugestão: instalável, acessibilidade >= 95, LCP < 2,5 s em 4G simulado).
- **Dependências:** LW.2.1 a LW.2.6.
- **Entregável:** **Rotas com `lazy`** (68 telas em `routes/router.tsx`; login, callback e 404 ficam eager): bundle inicial de **1,29 MB para 392 KB** (gzip de 366 para 122 KB). Logos reduzidos de 2400 para 800 px (62 KB para 37 KB, 37 KB para 19 KB) com `width`/`height` (sem salto de layout). Contraste do texto pequeno do Login corrigido (era `--color-text-muted`, 3,67:1). **Lighthouse mobile na tela de login contra o build local:** Acessibilidade **100**, Boas práticas **100**, Desempenho **93** (FCP 2,4 s, LCP 2,8 s, CLS 0,008, TBT 0 ms; simulação de 4G lento, sem CDN). SEO baixo é proposital (`noindex`). **Pendente:** (a) medir de novo em `app.selucra.com.br` com Brotli e CDN (a meta de LCP abaixo de 2,5 s não foi batida localmente por 0,3 s); (b) o Lighthouse não cobre as telas internas, que exigem login; (c) as duas versões do logo (claro e escuro) são baixadas, uma delas escondida: trocar por `<picture>` ou carregar só a do tema vale uns 20 KB. `theme-color` dos temas conferido; splash do Android vem do manifest (`background_color` e ícone 512).

---

## Fase 3 — Produção na web

Estado de partida: o `docker-compose.yml` é de desenvolvimento; o único CI existente é o de `backend` e `engine`. Nada disso foi
decidido ainda; **a primeira tarefa é escolher a hospedagem** (decisão do autor, pesar custo e operação).

### LW.3.1 · Decisão de hospedagem e ambientes (decidida em 2026-10-10; falta fechar o provedor e o tamanho do VPS)
- **Decisões do autor:** (1) **região São Paulo**; (2) **frontend no Cloudflare Pages** (DNS do `selucra.com.br` na Cloudflare, domínio registrado no Registro.br); (3) **orçamento de até ~R$ 200 por mês** no início, para testar; (4) backend, motor, gateway, Postgres e Redis em **um único VPS em São Paulo com Docker Compose**, Postgres no próprio VPS (padrão adotado por custo, a confirmar com o autor) com dump diário para fora do servidor (LW.3.3); API em `api.selucra.com.br`; staging como segundo compose no mesmo VPS ou VPS pequeno sob demanda.
- **Falta:** medir o consumo real dos containers (`docker stats` com carga) para fechar o tamanho do VPS; comparar provedores com datacenter em São Paulo (Vultr é o candidato; conferir preço oficial, Magalu Cloud e outros). Os preços das buscas de 2026-10-10 eram de terceiros e divergentes.
- **Descartado:** Hetzner (datacenter só na Europa/EUA, latência ~200 ms ao Brasil, preços e disponibilidade instáveis em 2026), PaaS por serviço (custo maior) e serverless/escala zero (o Temporizador e os bots do motor precisam ficar ligados).
- **O que fazer:** escolher onde roda o frontend estático (CDN) e onde rodam os containers (backend, motor, gateway, Postgres, Redis; Postgres gerenciado é o mais seguro para backup). Definir `staging` e `produção`. Registrar a decisão e o custo mensal estimado.
- **Aceite:** decisão registrada neste arquivo e na spec.

### LW.3.2 · Domínio, HTTPS, CORS e cabeçalhos
- **O que fazer:** domínio (landing em `selucra.com.br`, app em `app.selucra.com.br`, API em `api.selucra.com.br`; decisão de 2026-10-11), certificado, `FRONTEND_URL=https://app.selucra.com.br` (hoje o padrão é `localhost:5173`; atualizar também os exemplos em `.env.example` e `productionConfigGuard.test.ts`), `VITE_GATEWAY_URL`, cabeçalhos de segurança (CSP compatível com Stripe/RevenueCat, HSTS, `X-Content-Type-Options`), `Cache-Control` por tipo (HTML e `sw.js` sem cache longo; assets com hash imutáveis). Confirmar `trust proxy` do Express atrás do gateway (limitador de taxa depende do IP real). Atualizar os redirecionamentos do Google OAuth (origem e callback de produção) no Console.
- **Aceite:** login e-mail/senha, login Google e checkout funcionando no domínio real.
- **Dependências:** LW.3.1.

### LW.3.3 · Segredos, backups e restauração (backup e restauração detalhados na LW.3.12; segredos na LW.3.8)
- **O que fazer:** segredos fora do repositório (`.env` do backend nunca versionado, só `.env.example`); rotação de `JWT_SECRET`; backup automático dos dois bancos lógicos, **com restauração testada**; atenção ao `market_events` append-only (restore não pode quebrar o gatilho).
- **Aceite:** restauração a partir do backup numa instância limpa, registrada.
- **Dependências:** LW.3.1.

### LW.3.4 · CI/CD do frontend e do deploy
- **O que fazer:** workflow do frontend (lint, `tsc`, teste, build) no mesmo padrão dos de backend/engine; deploy automático para `staging` e promoção manual para produção; migrações do banco aplicadas no deploy; `docker compose` de produção separado do de desenvolvimento.
- **Aceite:** merge na `main` gera `staging`; promoção gera produção, com rollback documentado.
- **Dependências:** LW.3.1.

### LW.3.5 · Observabilidade e operação
- **O que fazer:** monitoramento de erros no frontend e no backend (conferir LGPD: sem patrimônio absoluto nem token em log), logs estruturados, verificação de saúde (`/health`) monitorada de fora, alerta de falha do worker de e-mail e do job de ranking (3 h), alerta de queda do Temporizador do mercado.
- **Aceite:** derrubar o motor em `staging` gera alerta.
- **Dependências:** LW.3.1.

### LW.3.6 · E-mail em produção
- **O que fazer:** domínio verificado no Resend (SPF, DKIM, DMARC), `EMAIL_PROVIDER=resend` em produção, webhook assinado apontando para o domínio real, remetente e `reply-to` definitivos.
- **Aceite:** recuperação de senha e verificação de e-mail chegam à caixa de entrada (não ao spam) no Gmail e no Outlook.
- **Dependências:** LW.3.2.

### Endurecimento para produção (LW.3.7 a LW.3.12, acrescentadas em 2026-10-10)

Origem: auditoria do que existe hoje (`docker-compose.yml`, `gateway/nginx.conf`, `backend/src/app.ts`, `.env.example`).
Postgres próprio no VPS (decisão de 2026-10-10) torna estas tarefas **pré-requisito de abrir o servidor à internet**, não polimento.
**Achados da auditoria** (todos verificados no código):

| # | Achado | Risco |
|---|---|---|
| a | `postgres` publica `5432:5432` e `redis` publica `6379:6379` no host, com senha padrão `tcc/tcc` e Redis sem senha | Banco financeiro acessível da internet; o Docker ainda **ignora o firewall `ufw`** ao publicar portas |
| b | Senhas e `JWT_SECRET` têm padrão no compose (`:-tcc`, `:-dev-secret-troque-em-producao`); o backend aceita subir assim, e `emailLinksConfig` também cai no segredo de dev | Esquecer uma variável em produção deixa o sistema "funcionando" com segredo público: qualquer pessoa forja JWT |
| c | `app.set('trust proxy', 1)` com a cadeia `Cloudflare/Caddy → nginx (gateway) → backend` (dois saltos): o backend enxergaria o IP do proxy, não o do usuário | O limitador de taxa trataria **todos os usuários como um só** (bloqueia todo mundo junto, ou não protege ninguém) |
| d | Nenhum `restart:` nem healthcheck de backend/engine/gateway, sem limite de memória, sem rotação de log | Reinício do servidor derruba tudo até alguém subir à mão; log enche o disco |
| e | Sem TLS, sem cabeçalhos de segurança (`helmet` não está no backend), `nginx.conf` sem limite de corpo, timeouts ou limitação de taxa | Tráfego em claro; superfície aberta |
| f | Não há script de backup nem de restauração; `avatar_data` (fotos) também é estado | Perda de dados irrecuperável (`market_events` é a fonte da verdade) |
| g | Seed do admin (`npm run db:seed:admin`) lê senha de variável de ambiente | Senha fraca/vazada no histórico do shell em produção |

#### LW.3.7 · Compose de produção
- **O que fazer:** `docker-compose.prod.yml` separado do de desenvolvimento (que continua igual). **Nada publicado ao host exceto o proxy 80/443**; Postgres, Redis, motor, backend e gateway só na rede interna (resolve a). Variáveis obrigatórias com `${VAR:?mensagem}` e **sem padrão** (resolve b); `POSTGRES_PASSWORD` e senha do Redis (`--requirepass`) fortes, e `DATABASE_URL`/`REDIS_URL` montadas com elas; `restart: unless-stopped`, healthchecks (backend, motor, gateway), limite de memória por serviço, `logging` com `max-size`/`max-file`, imagens com tag fixa (nada de `latest`). Proxy de borda **Caddy** (TLS automático Let's Encrypt, HTTP/2, renovação sozinha) na frente do gateway, ou apontar o Caddy direto para o backend e aposentar o nginx do caminho de produção (decisão da LW.3.9).
- **Aceite:** `docker compose -f docker-compose.prod.yml config` sem variável faltando; `nmap` externo no IP do servidor mostra só 22, 80 e 443; matar um container o faz voltar sozinho; reiniciar o servidor sobe tudo.
- **Dependências:** LW.3.1.

#### LW.3.7b · Ambiente de staging no mesmo VPS (decisão do autor em 2026-10-11)
- **Decisão:** haverá um **staging** para validar a versão antes de produção. Mesmo VPS, **outro projeto do Compose** (`-p selucra-staging`), com Postgres, Redis, rede e `.env` próprios; nada compartilhado com produção (outro `JWT_SECRET`, outras senhas, outro `SIMULATION_SEED`). Pode ficar **desligado** fora das validações, para não dobrar o consumo de memória (medir com `docker stats` antes de fechar o tamanho do VPS na LW.3.1).
- **URLs:** frontend `staging.selucra.com.br` (branch `staging` do Cloudflare Pages, com `VITE_GATEWAY_URL=https://api-staging.selucra.com.br` só no ambiente de preview); API `api-staging.selucra.com.br`. Hífen e não `api.staging.`: o certificado gratuito da Cloudflare cobre só um nível de subdomínio.
- **Serviços externos em modo de teste:** RevenueCat e Stripe em sandbox (chave `rcb_sb_`, webhook de sandbox apontando para `https://api-staging.selucra.com.br/billing/webhook`); cliente OAuth do Google próprio ou redirecionamento `https://api-staging.selucra.com.br/auth/google/callback` adicionado; e-mail em `EMAIL_PROVIDER=log` (ou Resend restrito aos endereços do autor), nunca para usuário real.
- **Acesso fechado:** Cloudflare Access (gratuito até 50 pessoas) liberando só o e-mail do autor, e `noindex`.
- **Deploy:** o mesmo `deploy.sh` com o ambiente como argumento; a **mesma imagem (SHA)** sobe no staging, é validada e só então vai para produção. Caddy escolhe o destino pelo nome do host.
- **Já feito no código:** `DEPLOY_ENV=staging` é aceito pela guarda de configuração (`productionConfigGuard.ts`): mesmas exigências de segredo, URL, banco e cobrança (`BILLING_PROVIDER=dev` continua recusado), mas `EMAIL_PROVIDER=log` é permitido. Testes novos em `productionConfigGuard.test.ts`.
- **A fazer:** `docker-compose.staging.yml` ou parametrização do compose de produção (LW.3.7), Caddyfile com os dois hosts, registro DNS `staging` e `api-staging`, branch `staging` no Pages, regra do Cloudflare Access.
- **Dependências:** LW.3.7, LW.3.1.

#### LW.3.8 · Guardas de configuração (recusar subir errado) ✅ (2026-10-10)
- **Entregável:** `backend/src/infra/productionConfigGuard.ts` (função pura sobre o `env`: `readDeployEnv`, `findProductionConfigProblems`, `assertProductionConfig`) chamada no começo do `main()` de `server.ts`, **antes das migrações**, então configuração errada nunca toca o banco. Com `DEPLOY_ENV=production` recusa: `JWT_SECRET` ausente, igual ao de dev ou com menos de 32 caracteres; `EMAIL_UNSUBSCRIBE_SECRET` (opcional) de dev ou curto; `EMAIL_PROVIDER` diferente de `resend`; `BILLING_PROVIDER=dev`; `FRONTEND_URL`/`PUBLIC_API_URL` ausentes, sem https ou em localhost; `GOOGLE_REDIRECT_URI` com as mesmas regras **só quando `GOOGLE_CLIENT_ID` está configurado**; `DATABASE_URL` sem senha, com senha padrão conhecida (`tcc`, `postgres`...) ou com menos de 16 caracteres; `REDIS_URL` e `ENGINE_URL` ausentes. Lista tudo de uma vez. `DEPLOY_ENV` com valor desconhecido (`prod`, `Production`) **derruba a subida** em vez de cair em desenvolvimento em silêncio. Em desenvolvimento (vazio ou `development`) não faz nada. `docker-compose.yml` repassa `DEPLOY_ENV` (padrão `development`) e `.env.example` ganhou a seção de produção. 17 testes novos; `npm run lint`, `build` e `npm test` (3746 passando) verdes; conferido subindo `node dist/server.js` com configuração de dev em produção (aborta listando 7 problemas) e com `DEPLOY_ENV=prod` (aborta). **Não coberto aqui (de propósito):** o motor em Go não tem guarda equivalente (a LW.3.7 tira os padrões do compose de produção, que é a barreira dele); o `docker-compose.prod.yml` com `${VAR:?}` é a LW.3.7. Sem rota HTTP nova, então sem `.docs/backend/` a atualizar.
- **O que fazer:** no backend, uma checagem de arranque que **aborta** quando `DEPLOY_ENV=production` e houver: `JWT_SECRET` ausente, igual ao de dev ou com menos de 32 caracteres; `EMAIL_UNSUBSCRIBE_SECRET` caindo no segredo de dev; `EMAIL_PROVIDER=log`; `BILLING_PROVIDER=dev`; `FRONTEND_URL`/`PUBLIC_API_URL`/`GOOGLE_REDIRECT_URI` apontando para `localhost`. **Usar uma variável própria (`DEPLOY_ENV`), não `NODE_ENV`**: a imagem Docker sempre roda com `NODE_ENV=production` (lição da MO.4.1). Fica numa função pura em `shared/` ou `config/` com teste de cada recusa; só a composição lê `process.env`. Documentar em `.docs/backend/` se afetar contrato; atualizar `.env.example` com uma seção "produção".
- **Aceite:** subir com qualquer uma das condições acima em `DEPLOY_ENV=production` falha com mensagem clara; o desenvolvimento local segue igual.
- **Dependências:** nenhuma (pode ser feita já).

#### LW.3.9 · IP real do usuário atrás dos proxies
- **O que fazer:** decidir e implementar **uma** cadeia e configurar `trust proxy` para ela (resolve c): (A) Cloudflare na frente da API (nuvem laranja: WAF e proteção de DDoS grátis, IP real em `CF-Connecting-IP`) + Caddy + backend; ou (B) só Caddy + backend. Em qualquer caso, o nginx do gateway ou sai do caminho ou repassa o IP original (`real_ip`), e o backend usa o número exato de saltos. Teste de integração: duas requisições com IPs diferentes caem em baldes diferentes do limitador, e um IP forjado por `X-Forwarded-For` do cliente é ignorado.
- **Aceite:** o limitador de taxa do login conta por usuário real em `staging`; `X-Forwarded-For` falso não muda o balde.
- **Dependências:** LW.3.7.

#### LW.3.10 · Cabeçalhos, limites e abuso
- **O que fazer:** `helmet` na API (JSON puro, política mínima); HSTS e `X-Content-Type-Options` no proxy; limite de tamanho de corpo e timeouts no proxy; limitação de taxa grossa por IP nas rotas de autenticação e de cadastro (além da do backend); CSP do frontend via `_headers` do Cloudflare Pages, liberando só o necessário (Stripe, RevenueCat, fontes locais). Revisar o `CORS` (`origin` exato do domínio, nunca `*`).
- **Aceite:** `securityheaders.com` nota A ou equivalente; corpo gigante é recusado; checkout e login ainda funcionam com a CSP ligada.
- **Dependências:** LW.3.7, LW.3.9.

#### LW.3.11 · Servidor: acesso e atualizações
- **O que fazer:** firewall `ufw` só 22/80/443 (e o compose sem portas publicadas, porque o Docker passa por cima do `ufw`); SSH só por chave, sem senha e sem login de root, usuário de deploy sem privilégio; `fail2ban`; `unattended-upgrades` para correções de segurança; relógio sincronizado; alerta de disco e memória; senha do admin da aplicação gerada longa e **digitada só pelo terminal interativo**, nunca em variável de ambiente persistida ou em arquivo versionado (resolve g).
- **Aceite:** varredura externa e tentativa de SSH por senha falham; checklist de hardening assinado e guardado no runbook.
- **Dependências:** LW.3.1.

#### LW.3.12 · Backup, restauração e runbook (detalha a LW.3.3)
- **O que fazer:** em `infra/backup/`, script de `pg_dump` (formato custom) dos **dois** bancos (`gamification` e `market`), **criptografado** antes de sair do servidor (por exemplo `age`), enviado para armazenamento de objetos externo (Backblaze B2 ou Cloudflare R2), retenção de 7 diários e 4 semanais; cópia do volume `avatar_data`; agendado por cron/systemd timer; **alerta quando o backup falha ou não roda**. Script de restauração e **teste de restauração automático semanal** num banco descartável, conferindo contagem de linhas e a integridade de `market_events` (o gatilho append-only precisa continuar valendo após o restore). Snapshot semanal do VPS como segunda rede. Registrar RPO/RTO esperados (sugestão: perder no máximo 24 h, voltar em menos de 2 h). Escrever `.claude/runbook-operacao.md`: deploy, rollback, aplicar migrações (Drizzle e golang-migrate; ver a nota de estado "dirty" em memória), girar segredos, criar o admin com segurança, restaurar do zero, o que fazer se o motor ou o Temporizador parar.
- **Aceite:** restauração completa numa máquina limpa a partir só do backup e do runbook, cronometrada e registrada; backup com falha gera alerta.
- **Dependências:** LW.3.7.

#### Deploy simples e repetível (LW.3.13 a LW.3.17, acrescentadas em 2026-10-10)

Análise completa em `.claude/analise-ambiente-producao.md` (tabela dev x produção, restrições de singleton, desenho do servidor).

#### LW.3.13 · Imagens construídas no CI e publicadas por SHA
- **O que fazer:** workflow que constrói `backend`, `engine` e `gateway` (este só se continuar existindo em produção, ver a análise seção 3), marca com o SHA do commit e publica no GHCR; `docker-compose.prod.yml` usa `image:` por tag, nunca `build:`; bases com versão fixa (`postgres`, `redis`, `caddy`, `node`, `alpine`, `golang`); `.dockerignore` revisado; varredura de vulnerabilidade (Trivy ou o scanner do GHCR) como etapa do CI, sem bloquear o merge no início.
- **Aceite:** um merge na `main` gera as imagens; o servidor sobe só com `pull`, sem compilar nada.
- **Dependências:** LW.3.7.

#### LW.3.14 · Encerramento limpo e seeds executáveis na imagem ✅ (2026-10-12)
- **O que fazer:** tratar `SIGTERM`/`SIGINT` no `server.ts` (parar de aceitar conexões, terminar requisições em andamento, parar os agendadores, fechar o pool do banco e o Redis) e no motor (`http.Server.Shutdown`, parar o Temporizador e os bots, fechar o pool), com teste do encerramento; incluir o binário `cmd/seed` do motor na imagem (hoje só `cmd/api` é compilado, então o catálogo de 35 ativos não consegue ser semeado em produção); backend: confirmar que `node dist/db/seed.js`, `seedLessons.js`, `seedAchievements.js` e `seedMissions.js` rodam na imagem final (sem `tsx`); documentar a ordem e a idempotência no runbook (LW.3.12). Checklist do backend e do motor aplicados (lint, build, testes).
- **Aceite:** `docker stop` encerra em poucos segundos sem erro nem requisição cortada; um servidor novo é semeado do zero só com comandos de dentro das imagens.
- **Dependências:** nenhuma (pode ser feita já, antes do servidor existir).
- **Entregável (parcial, seeds ✅ 2026-10-11; encerramento limpo pendente):** o binário `seed` do motor entra na imagem (`engine/Dockerfile`); os seeds do backend já rodam de `dist/` (`node dist/db/seed*.js`, sem `tsx`); o seed do admin lê a senha de `ADMIN_PASSWORD_FILE`, do terminal sem eco ou de pipe, e recusa `ADMIN_PASSWORD` com `NODE_ENV=production` (`src/db/adminPassword.ts`, com teste). Ordem, idempotência e o detalhe da conquista da Assembleia estão em `analise-ambiente-producao.md` seção 7. Provado numa stack descartável a partir das imagens (`tmp/seed-prod/prova.sh`). 
- **Entregável (encerramento limpo ✅ 2026-10-12):** backend: `infra/gracefulShutdown.ts` (para de aceitar conexões, espera as requisições até 8 s e corta o resto, para os 9 agendadores `setInterval`, fecha pool do Postgres e Redis, sai com 0 ou 1; segundo sinal ignorado) com `shutdownRegistry.ts` (`createDb` e `createRedisClient` registram o próprio fechamento) ligado em `server.ts` por `SIGTERM`/`SIGINT`; 3 testes. Motor: `httpserver.Serve`/`Run(ctx, ...)` com `http.Server.Shutdown` (8 s), `signal.NotifyContext` no `main`, Temporizador (e os bots, que rodam dentro do tick) parado e aguardado antes de `pool.Close`; 3 testes. Verificado: lint, build e `npm test` do backend (4216 passando), `golangci-lint` (0 issues), `go build`, `go vet` e `go test ./...` do motor; `docker stop` numa stack descartável (`tmp/seed-prod/prova-sigterm.sh`): backend 0,3 s e motor 0,1 s, ambos exit code 0, com os logs de encerramento. **Limite conhecido:** um job de agendador em andamento no `SIGTERM` não é aguardado (o pool fecha e a transação dele volta); todos os jobs são idempotentes.

#### LW.3.15 · Script de deploy com backup e rollback
- **O que fazer:** `infra/deploy/deploy.sh`: (1) backup (usa o da LW.3.12), (2) `docker compose pull` da tag nova, (3) `up -d`, (4) espera os healthchecks, (5) se falhar, volta a tag anterior (guardada num arquivo) e avisa; migração que falhou não se desfaz sozinha, então o roteiro também diz quando restaurar do backup. Documentar a **janela de deploy** (os agendadores são singleton, não há deploy sem interrupção, ver análise seção 4) e evitar horário de pico.
- **Aceite:** deploy bom, deploy com imagem quebrada (volta sozinho) e deploy com migração que falha (documentado) ensaiados em `staging`.
- **Dependências:** LW.3.12, LW.3.13, LW.3.14.

#### LW.3.16 · Deploy do frontend no Cloudflare Pages
- **O que fazer:** projeto no Pages ligado ao repositório (ou publicação pelo CI), com `VITE_GATEWAY_URL` e `VITE_REVENUECAT_WEB_PUBLIC_KEY` por ambiente (**embutidas na hora do build**, então trocar o valor exige novo build); `frontend/public/_redirects` com o fallback da SPA e `_headers` com CSP, cache e `sw.js` sem cache longo (alinhado à LW.2.2 e à LW.3.10); domínio `app.selucra.com.br` (a landing é outro projeto, LW.6.1), ambiente de preview por PR apontando para `staging`; procedimento de rollback (promover o deploy anterior).
- **Aceite:** F5 em uma rota interna (ex.: `/mapa`) não dá 404; o build de produção fala com `api.selucra.com.br` sem erro de CORS; preview de PR funciona.
- **Dependências:** LW.3.2.

#### LW.3.17 · Papéis de banco e senha do admin
- **O que fazer:** script de inicialização que cria `gamification_app` e `market_app` (sem superusuário, sem `CREATEDB`/`CREATEROLE`), donos de cada banco, e as `DATABASE_URL` de produção usam esses papéis; o superusuário `POSTGRES_USER` fica só para administração e backup. Conferir que as migrações (Drizzle e golang-migrate) funcionam com o papel restrito e que o gatilho append-only de `market_events` continua protegendo contra o próprio motor. Seed do admin lendo a senha de prompt ou arquivo temporário apagado em seguida, nunca de variável de ambiente ou argumento.
- **Aceite:** `\du` mostra os papéis sem superusuário; o app sobe, migra e opera; tentativa de `DROP TRIGGER` pelo papel do app é negada.
- **Dependências:** LW.3.7.

---

## Fase 4 — Fora do código (bloqueiam cobrar)

### LW.4.1 · Contas e produtos só da web (reescopo da MO.1.1)
- Conta Stripe ativa no Brasil conectada ao RevenueCat, produtos mensal e anual (R$ 9,90 e R$ 89,90), Offering `default` com os dois pacotes. **Sem Apple e Google.** Referência: MO.1.1 em `backlog-monetizacao.md`.

### LW.4.2 · Termos, reembolso, fiscal e privacidade (MO.1.2)
- Termos de assinatura, política de reembolso (direito de arrependimento de 7 dias do CDC), decisão fiscal com contador (o Stripe não emite NF-e), RevenueCat e Stripe como operadores na política de privacidade. **Preencher todos os `[PREENCHER ...]`** de `frontend/src` (hoje 10 ocorrências; lista em `.claude/politica-privacidade-placeholders.md`) antes de publicar `/privacidade`.
- **Andamento (2026-10-11):** páginas públicas `/termos` (Termos de Uso e da Assinatura PRO, 15 seções) e `/reembolso` (6 seções) criadas a partir dos rascunhos, com `pages/Termos/termsConfig.ts`; links no Login e na tela de planos (aviso de renovação automática e arrependimento de 7 dias). Padrões adotados: 18 anos, arrependimento de 7 dias que **não recomeça na renovação**, reembolso integral mesmo com uso, aviso de reajuste com 30 dias, foro do domicílio do consumidor (CDC art. 101, I). Política de privacidade preenchida (controlador, encarregado, Brasil, 18, data). **Decisão do autor (2026-10-11): começa como pessoa física e ativa a cobrança já; migra para MEI se houver tração.** Os termos mostram nome, "pessoa física" e Chapecó, SC, sem CPF nem endereço residencial (o Decreto 7.962/2013 pede CPF/CNPJ e endereço; risco aceito pelo autor na fase de validação, rever ao abrir o CNPJ em `termsConfig.ts`). Sem contador nem advogado por enquanto. **Faltam:** provedor de hospedagem (`policyConfig.ts`), citar RevenueCat/Stripe/Cloudflare/Resend como operadores na privacidade (rascunho em `rascunho-privacidade-operadores-pro.md`), decisão fiscal com o contador e **revisão por advogado antes de cobrar**.
- **Aceite:** `grep -rn "PREENCHER" frontend/src` vazio; textos publicados.

### LW.4.3 · Verificação de domínio e propriedade
- Domínio registrado no Stripe/RevenueCat para o checkout web; Search Console e metadados de compartilhamento (Open Graph/Twitter Card em `index.html` e na página da retrospectiva, já que ela é compartilhável).

---

## Fase 5 — Fechamento das pendências que o PRO deixou abertas

### LW.5.1 · MO.5.6 só na web
- Repetir o roteiro da Fase E em resolução mobile **no navegador e no PWA instalado** (320, 390, 768 px), sem emulador. O item "emulador Android" da MO.5.6 vira a LW.2.6. Corrigir o link "Privacidade e LGPD" de Configurações (17 px de altura, mínimo de 44 px).

### LW.5.2 · Mesclar o que está parado
- A cadeia de branches da Fase N (13 PRs) e a pilha da revisão de trilhas (#62 a #83) aguardam merge; a `main` precisa estar com tudo antes de produção. Rodar `docker compose up` e os e2e (`backend/test/e2e`) na `main` mesclada.

### LW.5.3 · Ensaio geral em `staging`
- Jornada completa com conta nova: cadastro com e-mail verificado, lição, compra de ativo, assinatura PRO com cartão de teste, cancelamento e reativação, exportação e exclusão LGPD, no navegador e no PWA instalado. Registrar o resultado aqui.

---

## Fase 6 — Landing page e SEO (acrescentada em 2026-10-11)

> Mockup aprovado pelo autor: https://claude.ai/artifact/8vZqUrBZbLZ3mUx8rfcKt3.
>
> **Decisões do autor (2026-10-11):**
> - **Landing separada do app, em HTML/CSS/JS puros** (sem React, sem pré-render): pasta `landing/` na raiz do repositório, projeto próprio no Cloudflare Pages em `selucra.com.br` (`www` redireciona para o domínio raiz). O app React fica em `app.selucra.com.br` e a API em `api.selucra.com.br`. Escolhida por entregar HTML pronto sem ferramenta de build e isolar o three.js do bundle do app. Nada estava em produção, então a troca de `FRONTEND_URL`, CORS, origem do Google OAuth, links de e-mail, `start_url` do PWA e domínio do checkout para `app.` só mexe em configuração (LW.3.2 e LW.3.16).
> - **Sem preço nem PRO na landing** ("grátis", "sem cartão" e a seção PRO ficaram de fora, para não parecer cobrança obrigatória).
> - **three.js só decorativo**, carregado depois do `load`.
> - **SEO como objetivo explícito.** O app inteiro (`app.`) sai do índice (`noindex`, fora do sitemap); a autoridade se concentra no domínio raiz.
> - `landing/` não tem Dockerfile (mesma regra do `frontend/`). Os tokens de cor e fonte vêm de `.claude/identidade-visual-tokens.md` e ficam duplicados em `landing/` e `frontend/src/index.css`: mudou um, muda o outro.

### LW.6.1 · Landing estática em `landing/`
- **O que fazer:** transformar o mockup em arquivos (`index.html`, `styles.css`, `main.js`, ícones SVG e fontes Inter/Sora locais), com hero, ticket, faixa de fatos, como funciona, trilha, recursos, demo de primeira ordem, FAQ, CTA final e rodapé, nos 3 breakpoints. Botões "Começar" e "Entrar" apontam para `https://app.selucra.com.br`. `h1` único, HTML semântico, sem layout shift, sem `maximum-scale`. Projeto no Cloudflare Pages com `_headers` (cache, CSP mínima) e redirecionamento `www` para o domínio raiz.
- **Aceite:** todo o texto do hero e do FAQ está no HTML entregue (sem JS); responsiva em 320, 390, 768 e 1280 px; funciona com JS desligado (só perde a demo e as animações).
- **Estado (2026-10-11): implementada, falta validar em produção.** Entregável: `landing/` (`src/index.html`, `styles.css`, `main.js`, `scene.js`, `svg.mjs`, `build.mjs`, `README.md`, 10 testes em `test/`). Conferido em 320, 390 e 1280 px e no `lighthouse` local (SEO 100, Acessibilidade 100, Boas práticas 100, CLS 0). Também feito (2026-10-11): botões "Criar conta"/"Começar" apontam para `/login?modo=cadastro` (o `Login` do app abre direto no cadastro, com teste); CI próprio em `.github/workflows/landing-ci.yml` (prettier, build e testes; dispara também quando `regulatoryFacts.ts` muda e toda segunda-feira, para pegar fato vencido). Lighthouse da home com gzip: Desempenho 99, Acessibilidade 100, Boas práticas 100, SEO 100 (LCP 1,6 s, CLS 0, TBT 130 ms em laboratório com GL por software). A cena 3D sozinha custava 1,5 s de TBT: passou a iniciar 1,5 s depois do `load`, a 30 quadros por segundo, sem antialias, e para sozinha em aparelho lento (média acima de 28 ms por quadro). Não testado em Safari e Firefox (o Firefox do ambiente não gerou captura). Analytics aprovado pelo autor (2026-10-11): Cloudflare Web Analytics, sem cookies, via `CF_ANALYTICS_TOKEN` no build (`landing/build.mjs`, CSP liberada em `_headers`); a política de privacidade do app (seção 6) passou a citar a medição. Falta o autor criar o site no Web Analytics e a variável no Pages (passo a passo em `checklist-contas-e-segredos-producao.md`). Pendente: projeto no Cloudflare Pages com `www` redirecionando para o raiz (depende da LW.3.16 e do domínio) e conferir 768 px com calma; fotos de tela em tablet só passaram por captura headless.

### LW.6.2 · Metadados, dados estruturados e `noindex` do app
- **O que fazer:** `title` (`Selucra | Simulador de Investimentos para Aprender na Prática`), meta description, `canonical`, Open Graph e Twitter Card com imagem 1200x630, JSON-LD `Organization`, `WebSite`, `SoftwareApplication` e `FAQPage` (perguntas escritas como as pessoas buscam), `sitemap.xml` e `robots.txt` da landing. Nenhuma menção a preço ou "grátis". No `frontend/`: `noindex` (meta e cabeçalho `X-Robots-Tag` no `_headers`) e `robots.txt` bloqueando o app; corrigir o viewport do `index.html` (remover `maximum-scale=1, user-scalable=no`). Registrar o domínio raiz no Search Console (LW.4.3).
- **Aceite:** Rich Results Test sem erro; Lighthouse SEO e Acessibilidade >= 95 na landing; o app não aparece no índice.
- **Estado (2026-10-11): feito na landing e no HTML do app; faltam os cabeçalhos e a validação externa.** Entregue: title, description, canonical, Open Graph e Twitter Card com `og-image.png` 1200x630, JSON-LD (`Organization`, `WebSite`, `SoftwareApplication`, `FAQPage` gerado do FAQ visível, com teste de consistência), `sitemap.xml`, `robots.txt`; no `frontend/`: viewport sem `maximum-scale`/`user-scalable`, `<meta name="robots" content="noindex, nofollow">` e `public/robots.txt` com `Disallow: /`. Pendente: `X-Robots-Tag: noindex` no `_headers` do app (entra com a LW.3.16, que cria esse arquivo), Rich Results Test e Search Console com a URL real.

### LW.6.3 · Cena three.js decorativa
- **O que fazer:** `three` hospedado junto da landing (arquivo local, não CDN), carregado por `import()` depois do `load`, em ociosidade; só os módulos usados; pausa fora da tela e em aba oculta; quadro estático com `prefers-reduced-motion`; não carrega com `saveData`; menos instâncias ou desligada em aparelho fraco; canvas `aria-hidden` com altura fixa.
- **Aceite:** LCP e CLS sem piora medível com e sem a cena; peso do arquivo medido e registrado aqui.
- **Estado (2026-10-11): implementada (`landing/src/scene.js`).** `three@0.170` tree-shaken no chunk `scene-*.js`: 480 KB sem compressão, ~121 KB gzip, baixado só depois do `load` e fora do JS principal (1,5 KB, 0,8 KB gzip). Opacidade baixa e máscara para não competir com o texto. Pendente: medir LCP/CLS com e sem a cena em produção com compressão (no servidor local sem gzip o Lighthouse deu performance 81 e LCP 4,1 s sob throttling móvel simulado; CLS 0).

### LW.6.4 · Páginas de conteúdo evergreen
- **O que fazer:** páginas HTML estáticas em `landing/aprender/...` (ex: `renda-fixa`, `o-que-sao-fiis`) reaproveitando lições e glossário, cada uma mirando uma busca específica, com links internos para a landing e entre si, entrando no sitemap. Definir antes a lista de temas com o autor.
- **Depende de:** LW.6.1 e LW.6.2.
- **Estado (2026-10-11): sistema pronto e três guias no build, aprovados pelo autor.** Decisão do autor: a home não tem seção de guias nem link no rodapé; o link "Guias" fica só no menu do cabeçalho. Guias (pesquisados em páginas oficiais do Tesouro Direto e da B3 e escritos com palavras próprias, levando para a aplicação): `o-que-e-selic-e-cdi`, `o-que-e-etf` e `o-que-e-tesouro-direto`, mais o hub `/aprender/`. Entregue: `landing/aprender.mjs`, `content/aprender/*.json`, sitemap gerado, JSON-LD `Article`, `BreadcrumbList` e `FAQPage` por guia, links entre os guias, 21 testes (inclui link quebrado e regras de fato) e Lighthouse 100/100/100/100 num guia. Os números vêm de `regulatoryFacts.ts` e a build recusa fato conferido só por trecho de busca ou com mais de 12 meses. Foram registrados 8 fatos novos (`tesouro-investimento-minimo`, `tesouro-tipos-titulos`, `tesouro-horario-negociacao`, `etf-definicao-b3`, `etf-liquidacao-b3`, `etf-formador-mercado`, `etf-codigo-lote`, `etf-ir-b3`) e `tesouro-resgate-liquidez` passou de trecho de busca para página oficial. Fora dos guias, por não terem página oficial aberta: intervalo e número de reuniões do Copom, IR de ETF segundo a IN RFB 1.585 e a isenção de come-cotas. O mínimo do Tesouro Direto diverge entre a página inicial (R$ 2) e material da B3 (R$ 30); o guia usa o site do programa. **Os três guias foram aprovados pelo autor em 2026-10-11, e a decisão é manter só eles por agora** (nada de novos temas até o autor pedir).

---

## Fica fora do lançamento (e por quê)

| Item | Estado |
|---|---|
| Fase D da monetização (compra nativa), MO.4.4 | Congeladas junto do app; o código existente fica inerte |
| Fase 4 do `backlog-app-mobile.md` (identidade, Play, iOS) | Adiada; retomar só quando o app voltar a ser prioridade |
| Fase F da monetização (Assembleia de Acionistas, MO.6.3 em diante) | Só faz sentido com base de assinantes; depois de medir tração |
| Fase G da monetização (MO.7.2 indicação, MO.7.3 teste de preço) | Depois do lançamento, com dado |

## Sequência sugerida

`LW.1.3 → LW.3.8 → LW.2.1 → LW.2.2 → LW.2.3 → LW.2.5 → LW.2.4 → LW.1.2 → LW.3.14 → LW.3.1 → LW.3.7 → LW.3.7b → LW.3.17 → LW.3.13 → LW.3.9 → LW.3.2 → LW.3.10 → LW.3.11 → LW.3.12 → LW.3.15 → LW.3.16 → LW.3.4 → LW.3.5 → LW.4.1 → LW.4.2 → LW.3.6 → LW.4.3 → LW.2.6 → LW.5.1 → LW.5.2 → LW.5.3 → LW.2.8 → LW.6.1 → LW.6.2 → LW.6.3 → LW.6.4`

(Revisada em 2026-10-10: a LW.3.8 sobe para o começo porque é código puro, independe de servidor e fecha o pior risco; o endurecimento LW.3.7 a LW.3.12 entra antes de qualquer servidor ficar acessível pela internet.)

Racional: o PWA (Fase 2) é código e pode andar enquanto a hospedagem e as contas (Fases 3 e 4, que dependem
do autor) são decididas. LW.2.6 e LW.2.8 precisam de um domínio HTTPS real, por isso vêm depois da Fase 3.
Nenhuma cobrança real sai sem LW.4.1, LW.4.2, LW.3.3 e a reconciliação da MO.2.5 em produção.
