# Backlog — Monetização (assinatura PRO, B2C, multiplataforma)

Backlog executável derivado de `.claude/estrategia-monetizacao.md` (produto) e
`.claude/analise-tecnica-monetizacao.md` (técnica), com as decisões fechadas pelo autor em
**2026-10-10**. Mesma relação que `backlog-app-mobile.md` tem com o documento de arquitetura dele:
os dois documentos são o "porquê"; este arquivo quebra em tarefas, uma por sessão.

## Decisões fechadas (2026-10-10)

| # | Decisão |
|---|---|
| M1 | **B2C puro.** Turmas/escolas (B2B) estão fora do plano. |
| M2 | **Assinatura em todas as plataformas**: web, Android e iOS. |
| M3 | **RevenueCat** é a camada única de assinatura (Stripe na web, Google Play Billing no Android, StoreKit no iOS). O backend não fala com Stripe, Apple nem Google diretamente. |
| M4 | **Dois planos, sem trial**: mensal **R$ 19,97** e anual **R$ 199,97** (~R$ 16,66/mês, ~17% de desconto). Um único entitlement `pro`. |
| M5 | **Pagamento nunca bloqueia o core loop** (lições centrais, XP/streak, compra/venda, ranking oficial). Cancelar nunca apaga progresso, só pausa capacidades. Regras da seção 2 e 6 da estratégia continuam valendo. |
| M6 | **Upsell só como convite**, nunca escassez ou cronômetro (limite ético de `proposta-engajamento-licoes.md`). |
| M7 | **O PRO é guiado por desejo, não por conteúdo.** Âncoras: ligas privadas e duelos, identidade visível (cosméticos, molduras, selo) e retrospectiva compartilhável; a quarta é a Assembleia de Acionistas (M8). Conteúdo avulso vende mal e fica fora do centro. |
| M8 | **Assembleia de Acionistas:** só PRO vota, o evento é público, o peso é pelas ações na data de corte entre quem votou, bots não votam, o efeito vale igual para todos. Quem não paga ganha **1 crédito de voto por mês**, como funcionalidade a mais. |
| M9 | O desenho da assembleia é **extensível por `kind`**; só `shareholder` entra agora. |
| M10 | **Conselho PRO fora** do plano. |
| M11 | Cripto/opções/derivativos, trilhas extras PRO, acesso antecipado, máquina do tempo, múltiplas carteiras e Assembleia dos Investidores ficam **adiados** (Fase H). |
| M12 | **Checkout web: Stripe conectado ao RevenueCat** (integração Stripe Billing do RevenueCat: Stripe Checkout embutido nos fluxos do RevenueCat, Customer Portal do Stripe para cancelar e trocar plano, recibos e e-mails de cobrança pelo Stripe). O backend continua falando só com o RevenueCat. **Sem Pix**, só assinatura recorrente no cartão. Web Billing do RevenueCat descartado por ora (documentação não conferida). |

**Decisões de 2026-10-10 (ponto 046):** preço final **R$ 19,90 / R$ 199,90** (a MO.1.1 só confirma que existem nas lojas); ligas até 3 por assinante e 20 membros; duelos 1v1 de 7 dias, até 3 simultâneos, XP só por participar; cosméticos: selo PRO + 6 molduras + 8 títulos, sem temas.

**Ressalva de preço:** Apple e Google trabalham com faixas de preço pré-definidas, e o valor
terminado em `,97` pode não existir em BRL. A tarefa MO.1.1 confirma o preço real nos consoles
antes de qualquer cobrança; o preço vive só na configuração dos produtos (lojas + RevenueCat), nunca
hardcoded em código ou lição. Meta: mesmo valor nas três plataformas.

## Como usar este arquivo

1. Siga a ordem das fases (A → H; a H é só lista de adiados). A Fase A é quase toda trabalho fora do código (contas, lojas,
   termos) e **bloqueia a produção**, não o desenvolvimento: dá pra começar a Fase B em paralelo com
   RevenueCat em modo de teste.
2. Cada tarefa é escopo de uma sessão. Ao concluir, marque ✅ e acrescente o bullet de Entregável
   (e marque no `backlog-pendencias-consolidado.md`, se a tarefa estiver listada lá).
3. **Fases B, C, E e F tocam `backend/`** (a F também toca `engine/`, com o checklist do Go): passam pelo checklist obrigatório do `CLAUDE.md` inteiro
   (port em `application/ports/`, adapter em `infrastructure/`, Zod na borda, teste no mesmo commit,
   `.docs/backend/billing.md` atualizado, lint/build/test, `docker compose up`).
4. **Gating de plano nunca é claim de JWT**: sempre consulta ao caso de uso de status (análise
   técnica, seção 5). Toda feature PRO responde `403 { error: 'requer plano PRO' }`, nunca `404`.
5. **Verifique a documentação atual do RevenueCat, da Apple e do Google antes de implementar**:
   nomes de eventos, cabeçalhos do webhook, produtos web e regras de loja mudam. O que está aqui é o
   desenho, não a referência de API.
6. Decisão de produto que não esteja aqui: pare e pergunte (regra 6 do `CLAUDE.md`) ou registre em
   `pontos-em-aberto-decisao-produto.md` (ponto 046 já abre as perguntas conhecidas).

## Arquitetura em uma tela

```
Web (SPA)  ─ compra via checkout web do RevenueCat/Stripe ─┐
Android    ─ compra via Play Billing (SDK react-native-purchases) ─┤
iOS        ─ compra via StoreKit (SDK react-native-purchases) ─────┤
                                                                   ▼
                                                    RevenueCat (entitlement "pro")
                                                                   │ webhook + REST
                                                                   ▼
        backend/modules/billing  (projeção local `subscriptions`, uma linha por usuário)
                                                                   │
                         getSubscriptionStatusUseCase  ◄── gating das features PRO
```

- `app_user_id` do RevenueCat = **`users.id`** (UUID). O app e a web fazem `logIn(userId)` antes de
  qualquer compra; nunca comprar como anônimo.
- O webhook é só um aviso: ao recebê-lo, o backend **consulta a API REST do RevenueCat** pelo estado
  atual do assinante e grava a projeção (robusto a eventos fora de ordem e repetidos). Idempotência
  por id de evento.
- `isActive(subscription, now)` é uma função pura em `domain/`: PRO se `expiresAt > now` (ou sem
  vencimento, no caso de concessão promocional). Assim um webhook de expiração perdido não deixa
  alguém PRO para sempre.
- Cancelar/gerenciar: o link depende de onde a pessoa assinou (`store`): Stripe/web, App Store ou
  Play Store. A tela mostra o destino certo.
- Dentro do app (WebView) o botão de assinar **não pode** levar a pagamento web (regra das lojas):
  o SPA detecta que está no app e troca o CTA por uma chamada à compra nativa (Fase D).

---

## Fase A — Pré-requisitos fora do código (bloqueiam produção)

### MO.1.1 · Contas, produtos e preço nas lojas
- **Descrição:** abrir/validar as contas e criar os produtos. Trabalho do autor com apoio do Claude
  em checklist; nenhum código.
- **O que fazer:**
  - Conta Apple Developer (App Store Connect) e Google Play Console (taxas anuais/únicas, conferir
    valor atual); conta RevenueCat; conta Stripe ativa para o Brasil (precisa de pessoa jurídica ou
    MEI, conferir exigência atual).
  - Criar os dois produtos de assinatura (mensal e anual) em cada loja e no Stripe, no mesmo grupo
    de assinatura, e mapear ambos para o entitlement `pro` no RevenueCat (um Offering `default`
    com os dois pacotes).
  - **Confirmar o preço realmente disponível** em BRL em cada loja (M4: `19,97`/`199,97` pode virar
    `19,90`/`199,90`), registrar o valor final aqui e na estratégia.
  - Web (M12): conectar a conta Stripe ao RevenueCat (só o dono do projeto conecta; instalar o app do
    RevenueCat pelo marketplace do Stripe), criar os produtos e preços recorrentes no Stripe (um
    preço por produto, só valor fixo recorrente, sem camadas nem uso), importá-los no catálogo do
    RevenueCat e ligá-los ao Offering `default`. Registrar o domínio no Stripe se a compra for
    iniciada pelo SDK web. Conferir a documentação atual na hora, a integração muda.
- **Aceite:** `Offering default` visível no painel do RevenueCat com os dois pacotes nas três lojas
  em modo de teste/sandbox; preço final registrado neste arquivo.
- **Dependências:** nenhuma.

### MO.1.2 · Termos, reembolso e fiscal
- **Descrição:** o mínimo legal para cobrar.
- **O que fazer:**
  - Termos de assinatura e política de reembolso (na web vale o direito de arrependimento de 7
    dias do CDC; nas lojas o reembolso é pela loja). Atualizar `PrivacidadeLgpd` com o operador
    novo (RevenueCat e Stripe, transferência internacional), no mesmo molde da EM.8.2.
  - Definir como emitir nota fiscal (o Stripe não emite NF-e brasileira) e o regime tributário;
    conversar com contador. Registrar a decisão, sem implementar emissão automática nesta fase.
- **Aceite:** textos publicados no app; decisão fiscal registrada.
- **Dependências:** MO.1.1.

### MO.1.3 · Medição mínima antes de vender
- **Descrição:** hoje não há telemetria. Sem funil não dá pra ajustar preço nem upsell.
- **O que fazer:** escolher a ferramenta (a decidir, respeitando LGPD e o RNF09: nada de patrimônio
  absoluto em evento), e instrumentar o funil mínimo: lição concluída → viu paywall → iniciou
  compra → assinou → cancelou. Detalhado na MO.7.1; aqui só a decisão da ferramenta.
- **Aceite:** ferramenta escolhida e registrada.
- **Dependências:** nenhuma.

---

## Fase B — Fundação do módulo `billing` (backend)

Objetivo: o backend sabe com certeza quem é PRO, sem nenhuma feature gateada ainda. Critério da
fase: assinar em sandbox muda `GET /billing/status` para PRO, cancelar/expirar volta para free.

### MO.2.1 · Domínio, tabelas e migração ✅ (2026-10-10)
- **Descrição:** `backend/src/modules/billing/domain/` e tabelas no banco `gamification`.
- **O que fazer:**
  - `subscription.ts`: entidade e `isActive(subscription, now)` pura (regra em M-arquitetura acima).
    Estados: `active`, `billing_issue`, `expired`, `none`. Carência de pagamento segue a do
    RevenueCat/loja (se o entitlement continua ativo, continua PRO).
  - Tabelas: `subscriptions` (`user_id` PK, `store` stripe|app_store|play_store|promotional,
    `product_id`, `period` monthly|annual, `status`, `expires_at`, `will_renew`, `management_url`,
    `last_event_at`, `updated_at`) e `billing_webhook_events` (`id` PK = id do evento, `processed_at`).
  - Migração Drizzle (atenção a `drizzle-generate-needs-tty` e ao `when` crescente do journal).
- **Aceite:** testes de `isActive` table-driven (ativo, vencido, sem vencimento, billing issue em
  carência); migração aplica no `docker compose up`.
- **Dependências:** nenhuma.

- **Entregável:** `domain/subscription.ts` (`isActive`, `subscriptionState`, `willRenew`, `inferPeriod`, `toStatus`, todas puras) e `domain/errors.ts`; tabelas `subscriptions` e `billing_webhook_events` (migração `0036_add_subscriptions`, `when` ajustado à mão porque o gerado era menor que o da 0035). **Desvio:** o `status` não é coluna, é derivado na leitura a partir de fatos gravados (`expires_at`, `grace_expires_at`, `billing_issue_detected_at`, `unsubscribe_detected_at`, `refunded_at`), porque ativo/vencido depende da hora de agora. Testes de domínio table-driven; integração em banco descartável (constraints, upsert, idempotência do log).
### MO.2.2 · Ports e adapter RevenueCat ✅ (2026-10-10)
- **Descrição:** `application/ports/` e `infrastructure/revenuecat/`.
- **O que fazer:**
  - Ports pequenas: `EntitlementProvider` (`getSubscriber(userId)` devolve o estado do entitlement
    `pro`), `SubscriptionRepository`, `WebhookEventLog`.
  - Adapter real com a API REST do RevenueCat (chave secreta só por env: `REVENUECAT_SECRET_KEY`,
    `REVENUECAT_WEBHOOK_AUTH`); nenhum import do SDK/HTTP fora de `infrastructure/`.
  - Fakes em `test/fakes/`.
- **Aceite:** adapter testado contra respostas gravadas (fixtures) da API; lint bloqueia import de
  infraestrutura em `domain/`/`application/`.
- **Dependências:** MO.2.1.

- **Entregável:** ports `EntitlementProvider`, `SubscriptionRepository`, `BillingWebhookEventLog`, `BillingUserLookup`, `SubscriptionCache` e `ReconciliationAudience`; adapter REST (`GET /v1/subscribers/{id}`, Bearer com a chave secreta, timeout, resposta validada com Zod) testado com fixtures no formato da documentação; `loadBillingConfig` (`BILLING_PROVIDER` padrão `disabled`, `REVENUECAT_*`); fakes em `test/fakes/`. Formato lido da documentação atual do RevenueCat em 2026-10-10 (customer info model e tipos de evento). **Ressalva:** nunca rodou contra o RevenueCat real, só contra fixtures e um servidor falso; conferir com a chave de teste quando existir.
### MO.2.3 · Webhook e status (rotas) ✅ (2026-10-10)
- **Descrição:** casos de uso `HandleBillingWebhookUseCase` e `GetSubscriptionStatusUseCase` e as rotas.
- **O que fazer:**
  - `POST /billing/webhook` (público; autenticado pelo cabeçalho secreto configurado no
    RevenueCat, comparação em tempo constante): registra o id do evento (idempotência, mesma
    transação), consulta `EntitlementProvider` pelo `app_user_id` do evento e dá upsert na
    projeção. Responde 200 também para evento repetido; 4xx/5xx só em erro real (para o
    RevenueCat reenviar).
  - Eventos relevantes: compra inicial, renovação, mudança de produto, cancelamento (ainda ativo até
    vencer), reativação, problema de cobrança, expiração, transferência entre contas. Qualquer
    outro evento é registrado e ignorado.
  - `GET /billing/status` (autenticado): `{ isPro, plan, store, expiresAt, willRenew, managementUrl }`.
    **Nunca** devolver dado de cobrança além disso.
  - Documentar em `.docs/backend/billing.md`.
- **Aceite:** teste de caso de uso com fakes (evento repetido não reaplica, evento fora de ordem
  converge, usuário inexistente é ignorado com log); teste de router (supertest) com e sem o
  cabeçalho; ponta a ponta com RevenueCat em sandbox.
- **Dependências:** MO.2.2.

- **Entregável:** `GET /billing/status` e `POST /billing/webhook` (`.docs/backend/billing.md`). Webhook autenticado pelo cabeçalho `Authorization` configurado no painel (comparação em tempo constante), 200 também para repetido/ignorado, 500 em falha (o RevenueCat reenvia 5 vezes), 503 desligado. Tipos tratados: compra, renovação, cancelamento, reativação, expiração, problema de cobrança, troca de produto, extensão, pausa, reembolso revertido, transferência, resgate e alias; os demais são registrados e ignorados. **Desvio:** o id do evento é gravado só depois de processar (o efeito é convergente), então uma falha deixa o evento reprocessável. Validado de ponta a ponta com o backend local, um banco descartável e um RevenueCat falso: compra, repetição, TEST, transferência e perda do entitlement com o mesmo JWT.
### MO.2.4 · Gating e cache de status ✅ (2026-10-10)
- **Descrição:** o helper que toda feature PRO vai usar.
- **O que fazer:** `GetSubscriptionStatusUseCase` consultado dentro de cada caso de uso gateado
  (nunca middleware genérico nem claim de JWT); cache Redis com TTL curto (poucos segundos),
  invalidado ao processar webhook do usuário; erro padrão `403 { error: 'requer plano PRO' }`.
- **Aceite:** teste provando que um cancelamento processado reflete na próxima requisição mesmo com
  token antigo; teste do cache (hit, invalidação).
- **Dependências:** MO.2.3.

- **Entregável:** `GetSubscriptionStatusUseCase` com cache Redis de 30 s que guarda os **fatos** (a decisão usa a hora de agora, então vencimento no meio do TTL não vira PRO), invalidado pelo webhook; `ProAccessGuard.assertPro(userId)` lança `ProRequiredError`, que o `jsonErrorHandler` converte em `403 { error: 'requer plano PRO' }`. Testes: cancelamento vale na próxima leitura sem depender do token, vencimento no TTL, Redis fora do ar cai pro banco.
### MO.2.5 · Reconciliação e concessão administrativa (parcial: reconciliação ✅ 2026-10-10, concessão pendente)
- **Descrição:** rede de segurança e ferramenta de suporte.
- **O que fazer:**
  - Job periódico (mesmo padrão dos jobs Node existentes, ex.: snapshot de ranking) que reconsulta
    no RevenueCat quem tem projeção ativa perto de vencer ou divergente, e corrige.
  - Painel admin: ver o plano de um usuário e **conceder PRO promocional** por período (via API de
    entitlement promocional do RevenueCat, para continuar uma só fonte da verdade); registrar em
    auditoria.
- **Aceite:** teste do job com divergência plantada; concessão aparece em `GET /billing/status`;
  `.docs/backend/admin.md` e `billing.md` atualizados.
- **Dependências:** MO.2.3.

- **Entregável (parcial):** `ReconcileSubscriptionsUseCase` + `startBillingReconciliationScheduler`, ligado no `server.ts` só com `BILLING_PROVIDER=revenuecat` (a cada 6 h, `BILLING_RECONCILE_INTERVAL_MS`): reconsulta quem tem projeção parada há mais de 12 h e vigência ativa ou vencida há menos de 3 dias, em lotes de 200, mais velhos primeiro; falha isolada não para o lote. **Pendente:** concessão de PRO promocional pelo painel admin. A referência do endpoint de concessão do RevenueCat não abriu pela ferramenta de leitura (404 nas páginas v1 e v2.3); só há indício, por fontes secundárias, de `POST /v1/subscribers/{id}/entitlements/{ent}/promotional` e da regra de que a nova concessão só vale se vencer 2 h depois da existente. Não escrevi adapter de memória: conferir a documentação atual (v1 ou a API v2 de concessão e revogação) com a chave em mãos e depois ligar ao painel com auditoria.
---

## Fase C — Web: planos, compra e gerenciamento

### MO.3.1 · Tela de planos (`/planos`) ✅ (2026-10-10)
- **Descrição:** tela nova nos três breakpoints (CLAUDE.md), seguindo `identidade-visual-*`. Mostra
  o que o PRO inclui, mensal e anual lado a lado (anual com o desconto calculado do preço real,
  nunca texto fixo), e deixa explícito o que continua grátis para sempre. Sem escassez, sem contador.
- **Aceite:** tela responsiva; textos sem travessão e sem jargão; preços vêm do Offering (não
  hardcoded); estado "você já é PRO" mostra o plano atual em vez do botão de compra.
- **Dependências:** MO.2.3.

- **Entregável:** rota `/planos` (`pages/Planos`, dentro do `AppShell`, sempre aberta): benefícios do PRO (todas as âncoras como incluídas, decisão do autor de que tudo sai junto antes do lançamento), o que segue grátis, e o painel de planos (lateral fixa no desktop, coluna única no mobile). Preços **não vêm do backend**: `features/billing/webPurchases` envolve o SDK web `@revenuecat/purchases-js@1.70.0` (chave pública em `VITE_REVENUECAT_WEB_PUBLIC_KEY`, configurado já com `appUserId = users.id`, nunca anônimo) e lê `getOfferings().current`; o SDK é importado dinamicamente (fora do bundle principal). Desconto do anual e "equivale a X por mês" calculados dos preços reais (`annualDiscountPercent`, `annualPerMonth`). Estados: cobrança desligada (`billingEnabled=false`) mostra aviso e nenhum preço; já PRO mostra plano e renovação/fim em vez da compra; erro de preço mostra mensagem. `vite.config.ts` ganhou o namespace `billing` no proxy. Testes: 4 da tela + 3 das funções puras. **Ressalva:** a documentação do RevenueCat confirma `configure(apiKey, appUserId)`, `getOfferings` e `purchase`, mas não foi testada contra o RevenueCat real (sem conta); pendente quando existir a chave: conferir que o Offering `default` devolve pacotes `$rc_monthly` e `$rc_annual` (outro identificador de pacote é ignorado pela tela).

### MO.3.2 · Compra na web e retorno ✅ (2026-10-10)
- **Descrição:** botão de assinar abre o Stripe Checkout pelo fluxo do RevenueCat (M12), com
  `app_user_id` = `users.id` (conferir na documentação atual de compra web como o id é passado, antes
  de implementar); ao voltar, a tela consulta `GET /billing/status` em polling curto até confirmar
  (a verdade é o webhook, nunca o redirect de sucesso).
- **Aceite:** compra em sandbox leva a PRO na tela sem recarregar; cancelamento no checkout volta
  sem efeito; estado "processando" tem limite de tempo e mensagem de ajuda.
- **Dependências:** MO.3.1, MO.1.1.

- **Entregável:** botão "Assinar mensal/anual" em cada plano de `/planos`; `usePurchaseFlow` chama `purchase()` do SDK (Stripe Checkout hospedado pelo RevenueCat, usuário já identificado por `users.id`) e, ao concluir, consulta `GET /billing/status` a cada 2 s por até 60 s e grava o resultado no cache (a tela vira "Você já é PRO" sem recarregar). Fases: cancelar a janela volta sem erro e sem consulta; "confirmando" mostra aviso; passado o limite aparece mensagem de ajuda dizendo para não pagar de novo; erro orienta a conferir o plano antes de tentar outra vez (não afirma "nada foi cobrado", porque o erro pode vir depois da cobrança). `isNativeApp()` (`window.ReactNativeWebView`) esconde o botão dentro do app e mostra "A assinatura pelo app chega em breve" (nenhum caminho de pagamento web no app; a compra nativa é a MO.4.2). Testes: 4 do hook e 2 novos da tela. **Não testado de ponta a ponta:** sem contas RevenueCat/Stripe (MO.1.1) só há fake do SDK. Quando existirem: definir `VITE_REVENUECAT_WEB_PUBLIC_KEY`, `BILLING_PROVIDER=revenuecat` e as chaves do backend, comprar em sandbox e conferir (a) o `app_user_id` no painel do RevenueCat igual ao `users.id`, (b) o webhook chegando e o status virando PRO dentro dos 60 s (o cancelamento no Stripe pode levar até 2 h para chegar), (c) o retorno do Stripe Checkout (o SDK abre o checkout sobreposto na própria página; conferir se há redirecionamento).

### MO.3.3 · Gerenciar assinatura ✅ (2026-10-10)
- **Descrição:** em Configurações, bloco "Seu plano": plano, próxima renovação ou data de término,
  e botão que leva ao destino certo conforme `store` (portal do checkout web, ajustes de assinaturas
  da App Store ou da Play Store). Instrução textual para quem assinou em outra plataforma.
- **Aceite:** cada valor de `store` mostra o destino e o texto corretos; cancelada mas ainda ativa
  mostra "PRO até dd/mm".
- **Dependências:** MO.3.2.

- **Entregável:** `PlanSection` (organismo) em Configurações, acima de "E-mails", alimentado por `describePlan(status, inApp)` (função pura testada em `features/billing/describePlan`). Por `store`: `stripe`/`rc_billing` leva ao `managementUrl` (portal do Stripe); `app_store` e `play_store` levam ao `managementUrl` ou, na falta dele, às páginas oficiais de assinaturas das lojas (constantes `APP_STORE_SUBSCRIPTIONS_URL`, `PLAY_STORE_SUBSCRIPTIONS_URL`); `promotional` só explica; `other` orienta a usar a plataforma de origem. Estados: ativa renovando ("Renova em"), cancelada ainda ativa ("PRO até dd/mm"), problema de cobrança (leva ao destino da loja), expirada (reafirma que nada foi apagado e oferece voltar), nunca assinou (convite para `/planos`). A seção some quando a cobrança está desligada e a conta nunca assinou. **Dentro do app o link do portal web é suprimido** e vira instrução textual (regra de nenhum caminho de pagamento web no app). Testes: 8 de `describePlan` + 3 do bloco. **Ressalva:** as duas URLs de fallback das lojas vêm de conhecimento geral, não de uma página conferida nesta sessão; confirmar nas documentações da Apple e do Google antes de publicar (o `managementUrl` do RevenueCat, quando vier, tem prioridade).

### MO.3.4 · E-mails do ciclo de vida PRO ✅ (2026-10-10)
- **Descrição:** no módulo `notifications` (port e outbox já existentes): boas-vindas ao PRO,
  problema de cobrança (pedir para atualizar o pagamento, com o link certo por loja), assinatura
  encerrada (reafirmando que nada foi apagado). E-mail transacional, não depende de opt-in de
  marketing; recibo continua sendo da loja/checkout.
- **Aceite:** três templates em funções TS puras testadas; disparo idempotente por evento de
  billing; tom sem culpa nem escassez.
- **Dependências:** MO.2.3 (e EM.1.x, já concluídas).

- **Entregável:** três templates transacionais em `registry.ts` (`pro_welcome`, `pro_billing_issue`, `pro_ended`, funções puras, sem travessão, sem culpa nem escassez, com testes). A decisão de quando enviar é `lifecycleEmails(prev, next, now)` (`billing/domain/lifecycleEmails.ts`, pura), chamada pelo `SyncSubscriptionUseCase`, então vale para webhook, reconciliação e (futuro) concessão; chave de idempotência por **fato** (período comprado, instante da falha, fim do período). Port `BillingMailer` + adapter `notificationsBillingMailer` sobre `EnqueueEmailUseCase`. Ordem escolhida de propósito: enfileirar **antes** de gravar a projeção (falha do outbox não grava e o webhook reenviado refaz o aviso). `createBillingModule`/`createBillingReconciliation` passaram a receber `enqueueEmail` (em `app.ts` a criação do billing foi movida para depois dele). Documentado em `.docs/backend/billing.md` e `notifications.md`. `npm run lint`, `build` e `test` passam; backend sobe no compose e `/billing/status` responde 401 sem token. **Regras que valem registrar:** (a) boas-vindas de reassinatura só depois de 7 dias sem PRO (`RESUBSCRIBE_AFTER_MS`), para renovação com webhook atrasado não parecer nova compra; (b) "encerrada" só para quem já tinha projeção gravada; (c) os links de fallback das lojas estão duplicados do frontend (`APP_STORE_SUBSCRIPTIONS_URL`, `PLAY_STORE_SUBSCRIPTIONS_URL`), a conferir na documentação das lojas. **Não testado com provedor real:** o fluxo webhook → e-mail só foi exercitado com fakes; com a conta RevenueCat em sandbox conferir que chega um `pro_welcome` por compra e que repetir o webhook não duplica.

---

## Fase D — App mobile: compra nativa

Todas tocam `mobile/` e dependem da Fase 1 do `backlog-app-mobile.md` (app rodando). Ver a
arquitetura do app para a ponte WebView.

### MO.4.1 · SDK de compras no app
- **Descrição:** `react-native-purchases` (RevenueCat) configurado por plataforma; `logIn(userId)`
  quando a sessão do app é estabelecida e `logOut` ao sair.
- **Aceite:** em build debug, o app lista o Offering `default` no log e o `app_user_id` coincide com
  `users.id`.
- **Dependências:** `backlog-app-mobile.md` 2.1 (ponte de sessão), MO.1.1.

### MO.4.2 · Ponte WebView ↔ compra nativa
- **Descrição:** o SPA detecta que roda no app (flag injetada) e, em vez de abrir o checkout web, envia
  `{ type: 'purchase', plan: 'monthly' | 'annual' }` por `postMessage`; o app chama a compra
  nativa e devolve `{ ok | cancelled | error }`; o SPA refaz o polling de status.
- **Aceite:** compra em sandbox no emulador/dispositivo resulta em PRO na tela; usuário cancelando a
  folha de pagamento volta sem erro; nenhum link de pagamento web aparece dentro do app.
- **Dependências:** MO.4.1, MO.3.1.

### MO.4.3 · Restaurar compras e gerenciar por loja
- **Descrição:** botão "Restaurar compras" (exigido pelas lojas), link de gerenciar assinatura da
  loja correta, e comportamento claro quando o mesmo usuário assinou em outra plataforma.
- **Aceite:** reinstalar o app e restaurar devolve o PRO; conta com assinatura em outra loja não
  oferece nova compra (evita cobrança dupla).
- **Dependências:** MO.4.2, MO.3.3.

### MO.4.4 · Teste em sandbox e checklist de revisão das lojas
- **Descrição:** roteiro com testadores de licença (Google) e conta sandbox (Apple); cobrir compra,
  renovação, cancelamento, falha de cobrança e reembolso. Checklist das regras de revisão (descrição
  da assinatura, preço, link de termos e privacidade, restaurar compras, sem desvio de pagamento).
- **Aceite:** roteiro executado e registrado; checklist assinado antes do envio para revisão.
- **Dependências:** MO.4.3. Validação de iOS fica com o resto da validação iOS (Fase 4 do app).

---

## Fase E — Âncoras do PRO: identidade, ligas, duelos, retrospectiva

Princípio (M7): o PRO precisa dar **vontade de ter** (competir com amigos, ser visto, ter orgulho de
mostrar), não ser só uma lista de utilidades. Nenhuma tarefa esconde algo já conquistado, e todas
seguem a regra de cancelamento (arquivar, nunca apagar). Dependem da Fase B; as que têm tela de
compra esperam a Fase C. Cada uma passa pelo checklist do backend e do frontend (três breakpoints).

### MO.5.1 · Identidade visível (cosméticos, molduras, títulos e selo PRO) ✅ (2026-10-10)
- **Descrição:** tabelas `cosmetic_items` e `user_cosmetics` (nunca reusar o catálogo de conquistas;
  emblema de conquista real continua grátis). Itens: temas, molduras de avatar, títulos e o selo PRO.
  Extensão do módulo `profile`. **O que vende é a visibilidade:** moldura, título e selo aparecem
  para os outros no ranking, no feed social, na busca de amigos e no perfil público; cosmético que só
  o dono vê não entra. Seletor em Configurações/Perfil.
- **Aceite:** o item equipado aparece nas telas citadas para outro usuário; cancelar desequipa e
  arquiva, reativar restaura; nenhum cosmético muda a ordem do ranking nem expõe patrimônio absoluto
  (RNF09); testes do arquivamento e da reativação.
- **Dependências:** MO.2.4.

- **Entregável:** módulo novo `backend/src/modules/cosmetics` (DDD lite; **desvio:** o backlog dizia "extensão do `profile`", mas ranking, feed, amizades e perfil precisam ler a vitrine por porta, então um módulo próprio ficou mais limpo). Tabelas `cosmetic_items` (catálogo como dado, inserido pela migração `0037`: 6 molduras e 8 títulos) e `user_cosmetics` (uma escolha por tipo). **Selo PRO não é item:** aparece sozinho para quem é PRO. Rotas `GET/PUT/DELETE /me/cosmetics` (`.docs/backend/cosmetics.md`); equipar exige PRO (`403 requer plano PRO` via `ProAccessGuard`), tirar nunca. **Arquivamento sem escrita:** a escolha fica guardada e a leitura pública (`GetCosmeticDisplaysUseCase`, 3 consultas fixas por página) só a mostra enquanto a pessoa é PRO agora, então cancelar esconde e reativar restaura sozinho. Billing ganhou `SubscriptionRepository.findMany` e `ListActiveProUserIdsUseCase` (leitura em lote). Campo `cosmetics: { isPro, frame, title }` entra em `GET /ranking`, `/social-feed`, `/users/search`, `/friendships`, `/friendships/requests` e nos perfis; `shared/publicCosmetics.ts` guarda o tipo e o adapter em processo (ports opcionais no fim dos construtores existentes). Ordem do ranking provada intacta por teste. Frontend: átomos `ProSeal`, `UserTitle`, `AvatarFrame` (`Avatar` ganhou `frame`), molécula `CosmeticTags`, organismo `CosmeticsPicker` em Configurações (PRO escolhe; quem não é PRO vê a vitrine com convite; quem cancelou vê "escolhas guardadas"); some com cobrança desligada. Tokens `--frame-*` na seção 2.7 de `identidade-visual-tokens.md`. Validado de ponta a ponta com docker compose e no navegador (ranking, perfil, busca, cancelar e reativar). **Proposta de catálogo, para sua revisão:** molduras Aurora, Oceano, Crepúsculo, Ametista, Coral, Grafite; títulos Investidor Paciente, Mente Curiosa, Diversificador, Leitor de Balanços, Caçador de Dividendos, Visão de Longo Prazo, Estrategista, Sangue Frio (sem promessa de ganho). Troquei "Âmbar" por "Crepúsculo" para nenhuma moldura ser dourada (dourado é conquista). **Ressalvas:** o status de plano tem cache de 30 s, então equipar logo após assinar por inserção direta no banco pode dar 403 até expirar (o webhook invalida em produção); molduras só aparecem em `Avatar`, ranking e perfil, não existe avatar na lista de ranking por linha (só selo e título).

### MO.5.2 · Ligas privadas (3 sessões) ✅ (2026-10-10)
- **a) Domínio e dados:** módulo novo `leagues` (consome `ranking` por porta): `leagues`,
  `league_members`; janela e regra de pontuação a partir de `ranking/domain/window.ts`; só
  rentabilidade percentual, nunca patrimônio absoluto (RNF09).
- **b) Casos de uso e rotas:** criar liga exige PRO; **participar** não exige (membro gratuito entra
  na liga de um amigo PRO); convite só entre amigos com amizade aceita. Liga cujo criador cancelou
  fica arquivada e volta na reativação.
- **c) Frontend:** criar e gerenciar liga, e variante do ranking por liga.
- **Aceite:** ranking oficial Global/Amigos intacto; testes de gating, convite e arquivamento;
  `.docs/backend/leagues.md`.
- **Dependências:** MO.2.4. Decisão aberta (ponto 046): quantas ligas por assinante, quantos membros.

- **Entregável (a):** módulo `backend/src/modules/leagues` (domínio e dados). Tabelas `leagues` (dono, nome 3 a 40, janela `week`|`month`, `closed_at`) e `league_members` (`invited`|`active`, quem convidou), migração `0038`. Domínio puro: limites (3 abertas por dono, 20 pessoas), `normalizeLeagueName`, `isLeagueArchived(ownerIsPro)`. **Decisões de desenho:** (1) liga arquivada **não é estado gravado**, é derivada do plano do dono a cada leitura, como nos cosméticos, então reativar devolve a liga sem escrita; (2) `closed_at` é o encerramento voluntário pelo dono e libera a vaga das 3 (nada é apagado); (3) o teto de 3 abertas e o de 20 pessoas (membros mais convites pendentes) são garantidos **no banco, em transação com trava de linha** (`createIfUnderLimit`, `addMemberIfRoom`), provado por teste de concorrência em banco descartável; (4) a pontuação não é coluna: é sempre a rentabilidade percentual da janela do ranking. Port `LeagueRepository` + adapter Drizzle + fake. A leitura de pontuação do `ranking` entra na 2b, junto dos casos de uso.

- **Entregável (b):** casos de uso `CreateLeague` (PRO, teto de 3), `InviteToLeague` (dono com PRO, só amigo aceito, teto de 20), `RespondToLeagueInvitation` (**nunca exige PRO**), `LeaveLeague`, `RemoveLeagueMember`, `RenameLeague` (PRO), `CloseLeague`, `ListMyLeagues`, `GetLeague` e as 9 rotas de `/leagues` (`.docs/backend/leagues.md`). Pontuação: novo `RankUsersByProfitabilityUseCase` no módulo `ranking` (mesmo snapshot do job, filtra o grupo, pontua ao vivo só quem entrou depois, sem snapshot calcula o grupo) ligado às ligas pela port `LeagueScoreReader`; só `profitabilityPct` atravessa a fronteira. Ranking Global/Amigos intacto. Liga de fora/encerrada responde 404 (nunca vaza). Adapters em processo para `billing` (PRO em lote), `friendships` (amizade aceita) e `ranking`. Validado de ponta a ponta no compose: usuário gratuito recebe 403 ao criar, dono PRO cria, convida amigo, o gratuito aceita e vê a classificação (com selo PRO do dono), e ao vencer o plano do dono a liga vem `archived: true` e o dono perde só criar. **Decisões minhas, para sua revisão:** (1) dono sem PRO ainda consegue **remover membros e encerrar** (limpar o que já tem), mas não convidar, renomear nem criar; (2) convite aparece na lista de ligas da pessoa (sem e-mail por ora, é opt-in a decidir); (3) não há teto de quantas ligas uma pessoa pode **participar** (a decisão cobre só criar), registrado como ponto 047. Teste de concorrência dos tetos em banco descartável.

- **Entregável (c):** serviço `services/leagues`, hooks `features/leagues/useLeagues`, rotas `/ligas` (lista, convites, criar) e `/ligas/:id` (classificação, convidar, renomear, encerrar, sair), proxy `leagues` no Vite. Componentes: molécula `LeagueCard`; organismos `LeagueStandings` (posição, avatar com moldura, selo e título, percentual do período; botão "Tirar" só para o dono), `LeagueCreateForm` (PRO cria; quem não é PRO vê o convite "criar faz parte do PRO, participar é de graça" com link para `/planos`; some com cobrança desligada) e `LeagueInvitePanel` (só amigos aceitos que ainda não estão na liga). Atalho "Ligas com amigos" na Classificação. Composição própria no desktop (lista à esquerda e criação fixa à direita; classificação à esquerda e gerenciamento fixo à direita) e coluna única no mobile, conferido no navegador em desktop e 390px. Liga pausada mostra o aviso e mantém a classificação; convidado vê o convite e só depois a disputa; o 409 do teto de 3 aparece com a mensagem do servidor. Ranking oficial intacto. 25 testes novos de tela e componentes. **Ressalva:** não há entrada de "Ligas" na barra principal (só pela Classificação e URL), para não competir com as abas do core loop; decidir se vira aba quando as ligas forem lançadas.

### MO.5.3 · Duelos entre amigos ✅ (2026-10-10)
- **Descrição:** desafio de duração fixa (por exemplo 7 dias) entre dois amigos, vence quem tiver a
  maior rentabilidade percentual no período. Reaproveita o cálculo e a janela das ligas. Criar o
  duelo é PRO; **aceitar** não exige PRO. Resultado vira item do feed social e, opcionalmente,
  e-mail (opt-in existente). Sem XP por vencer, só por participar (evita incentivo a risco).
- **Aceite:** empate e abandono tratados; duelo de quem cancelou o PRO termina normalmente (arquivar,
  nunca apagar); testes de caso de uso e router.
- **Dependências:** MO.5.2a.

- **Entregável:** módulo `backend/src/modules/duels` (tabela `duels`, migração `0039`; `.docs/backend/duels.md`) e telas `/duelos` e `/duelos/:id`. Desafiar exige PRO (`403 requer plano PRO`); **aceitar e recusar nunca**; 1 contra 1, 7 dias a partir do aceite, até 3 simultâneos por pessoa (ativos nos dois lados mais desafios que a pessoa fez e aguardam resposta, garantido em transação com trava de linha, provado em banco descartável). **Medição:** novo `MeasurePeriodReturnUseCase` no `ranking` (replay do log de eventos nos instantes de início e fim, renda fixa a custo dos dois lados, mesma fórmula do ranking, `operated` = fez ordem de renda variável ou fixa no período), então o resultado é o mesmo qualquer que seja a hora em que o job roda. **Desfecho** (`decideDuel`, pura, table-driven): maior rentabilidade vence; mesma rentabilidade na precisão exibida de 2 casas é empate; só um operou, vence por abandono; nenhum operou, empate sem XP nem feed. **XP só por participar:** 20 XP fixos para cada pessoa que operou, igual para quem vence ou perde. **Job** `SettleDueDuelsUseCase` (a cada 1 h e uma vez na subida, `DUEL_SETTLE_INTERVAL_MS`): encerra os vencidos com transição condicional ao estado (idempotente), expira desafios sem resposta e credita o XP com rede de segurança (`xp_awarded_at`); falha ao medir deixa o duelo ativo para a próxima rodada. **Cancelar o PRO nunca interrompe um duelo.** **Feed:** coluna `social_feed_events.data` e tipos `duel_won`/`duel_draw`; o feed celebra só quem venceu (ou quem desafiou, no empate) e nunca mostra percentual nem derrota. Frontend: `DuelCard`, `DuelScoreboard` (placar lado a lado, parcial ao vivo, motivo do desfecho), `DuelChallengePanel` (PRO escolhe o amigo; quem não é PRO vê o convite com a frase "aceitar é de graça"), atalho na Classificação. Validado de ponta a ponta no compose com o motor real: 403 para gratuito, aceite, placar parcial, encerramento por abandono, feed e +20 XP (dados de teste revertidos). **Decisões minhas, para sua revisão:** XP de 20 e prazo de 7 dias para o desafiado responder (depois expira e libera a vaga). **Não feito:** e-mail de resultado (a spec dizia "opcionalmente"), conferência de XP duplicado em falha parcial (pode repetir 20 XP, documentado). Ressalva: o contador `xpGranted` do log do job só conta a rede de segurança.

### MO.5.4 · Retrospectiva compartilhável (mensal; anual depois) ✅ (2026-10-10)
- **Descrição:** resumo da jornada do mês: lições concluídas, maior sequência, melhor decisão em
  percentual, evolução de nível, conquistas e duelos/ligas. Apresentação em cartões, com imagem
  exportável para compartilhar. **Nunca patrimônio absoluto** (só percentual, nível e conquistas).
  Versão simples para todos; a completa e a imagem personalizada com a identidade da MO.5.1 são PRO.
  Geração por job mensal (padrão dos jobs Node existentes), sem curadoria humana.
- **Aceite:** conteúdo calculado só de dados que já existem; imagem exportável sem dado sensível;
  teste do job e do cálculo; revisão contra a regra "nunca culpa nem escassez".
- **Dependências:** MO.5.1, MO.5.2 (para citar ligas), MO.2.4.

- **Entregável:** módulo `backend/src/modules/retrospectives` (`.docs/backend/retrospectives.md`), tabelas `daily_activity` e `retrospectives` (migração `0040`), rotas `GET /retrospectives` e `GET /retrospectives/:month`, telas `/retrospectiva` (atalho em Meu Perfil). **Decisões do autor aplicadas (2026-10-10):** sem histórico de XP; a maior sequência vem de uma **tabela de dias de atividade** (dia presente = manteve, ausente = off), que também alimenta um calendário do mês; "melhor decisão" = melhor rentabilidade do mês (a do ranking, replay do mês inteiro); compartilhamento no estilo dos apps de hábito (imagem com a sequência e marcos, texto curto); grátis vê 3 métricas (lições, conquistas, nível), PRO vê completa + imagem personalizada. **Como ficou:** a versão completa (calendário, maior sequência, rentabilidade, duelos, ligas) **nem sai do servidor** para quem não é PRO (`premium: null`); cada mês é arquivado uma vez (nunca recalculado) com o conteúdo completo, então cancelar volta à versão simples sem apagar e assinar libera o arquivo inteiro. Job mensal (`RETROSPECTIVE_INTERVAL_MS`, 1 h, idempotente, uma falha não para as outras, nada gravado pela metade) mais geração sob demanda na primeira leitura; só meses fechados, do mês de cadastro em diante. `TouchStreakUseCase` ganhou o registro do dia (best-effort); a migração preenche o passado a partir das lições concluídas (missões e dias sem lição só daqui para frente). **Imagem:** PNG de 1080x1350 desenhado em canvas, sem biblioteca nova, compartilhada pelo menu do sistema quando existe e baixada nos demais casos; PRO sai com moldura, título e selo, calendário de dias e marcos em percentual; a versão gratuita sai simples. **Nunca valor em reais:** o autor citou "marco de dinheiro" como exemplo; mantive só marcos em percentual, nível, sequência e duelos, por causa do RNF09 (valor absoluto nunca em conteúdo compartilhável). Validado de ponta a ponta no compose (dados de teste revertidos). **Ressalvas:** o compartilhar da imagem não foi testado dentro do app mobile (WebView; baixar arquivo é a pendência 2.x do app); não há versão anual (o backlog diz "anual depois"); nenhum e-mail de retrospectiva.

### MO.5.5 · Convite contextual para o PRO
- **Descrição:** onde o convite aparece, sempre dispensável e sem repetição agressiva: criar liga ou
  duelo, perfil/cosméticos, a retrospectiva, a assembleia (Fase F) e uma linha opcional no resumo
  semanal por e-mail (respeitando o opt-in). Pode incluir o teste de interesse "tenho interesse" por
  âncora antes de construir a seguinte, medido pelo funil da MO.7.1.
- **Aceite:** nenhum convite bloqueia ação do core loop; dispensar lembra a escolha; revisado contra
  `proposta-engajamento-licoes.md`.
- **Dependências:** MO.5.1, MO.3.1.

---

## Fase F — Assembleia de Acionistas (PRO decide, todos veem)

Quarta âncora do PRO e a que mais dá a sensação de "estou influenciando o app". Depende de haver
base de assinantes para as assembleias terem votantes; construir **depois** das âncoras da Fase E.
Decisões (M8, M9) e o desenho extensível estão na análise técnica (seção 0.1).

**Regras fechadas (autor, 2026-10-10):**
- **Só PRO vota; o evento é visível para todos.** Pauta, opções, ficha e placar são públicos.
- **Crédito mensal para quem não paga:** 1 voto por mês, usado numa assembleia de uma empresa que a
  pessoa possui. Enquadrado como funcionalidade a mais, nunca como bloqueio do app. Exige e-mail
  verificado e nível mínimo (valor em configuração).
- **Bots não votam.** O peso do voto é a quantidade de ações do usuário na **data de corte**
  (posição na abertura), calculado **entre quem votou**.
- **Efeito igual para todo acionista**, pago ou não.
- **Mínimo de votantes distintos** (configurável, ponto de partida 3); abaixo disso a pauta não passa
  e nada muda. Empate mantém o status quo.
- **Pautas de um catálogo fechado, de dois lados** (cada opção tem ganho e perda), sem texto livre e
  sem curadoria humana. PRO propõe pautas; as mais apoiadas entram na próxima assembleia da empresa.
- **Efeito só nos fundamentos**, nunca no preço direto: o preço continua vindo da negociação dos
  bots reagindo. Efeito limitado em faixa, aplicado de forma gradual, no máximo uma mudança por
  empresa por trimestre.
- **Sem recompensa por vencer:** XP e conquista só por participar.
- **Extensível:** o desenho trata a assembleia como um `kind`; só `shareholder` entra agora.

### MO.6.1 · Fundação genérica de assembleia (backend)
- **Descrição:** módulo `assemblies` (DDD lite). Domínio: `Assembly` (`kind`, `subject_ref`,
  `opens_at`, `snapshot_at`, `closes_at`, `effect_applies_at`, `status`), `AgendaOption`, `Vote`.
  Três políticas por `kind`, escolhidas por uma tabela de registro em `application/` (sem `if kind`
  espalhado): `EligibilityPolicy`, `WeightPolicy`, `EffectApplier`. Implementação inicial só de
  `shareholder`. Tabelas: `assemblies`, `assembly_options`, `assembly_votes`, `assembly_vote_credits`.
- **Aceite:** testes de domínio table-driven (peso entre votantes, mínimo de votantes, empate,
  mudança de voto até fechar); adicionar um `kind` fictício nos testes sem alterar o núcleo; lint de
  camadas verde.
- **Dependências:** MO.2.4.

### MO.6.2 · Motor: data de corte e decisão como evento (Go)
- **Descrição:** pacote novo em `engine/internal/domain/` (por exemplo `corporategovernance`):
  (1) **snapshot de posições** da empresa na abertura, só contas de usuário (`is_bot` excluído),
  em tabela própria; (2) endpoint para registrar a **decisão** de uma assembleia, idempotente pelo id
  da assembleia, gravada em `market_events` **antes** de qualquer efeito (regra de Event Sourcing do
  projeto); (3) catálogo de efeitos como funções puras com faixa máxima, aplicação gradual em N
  ticks e cooldown por empresa. Parâmetros em `enginesetting`, nunca fixos.
- **Aceite:** testes table-driven dos efeitos (limites, gradualidade, cooldown, determinismo por
  seed, RNF08); teste de integração em banco descartável (lembrar: `market_events` é append-only);
  `.docs/engine/<pacote>.md`; `golangci-lint` verde.
- **Dependências:** nenhuma de billing; usa `fundamentals`, `dividend`, `macroevent` como
  referência.

### MO.6.3 · Ciclo de vida: abrir, fechar e aplicar
- **Descrição:** job que abre a assembleia alguns dias depois do balanço da empresa (evento já no
  Calendário), pede o snapshot ao motor (port `HoldingsSnapshotProvider`), fecha na data prevista,
  apura, envia a decisão ao motor e marca o resultado. O resultado fica **público antes** de o
  efeito valer (próximo ciclo). Entra no Calendário como evento de mercado.
- **Aceite:** reexecução do job não duplica abertura nem decisão; assembleia sem mínimo de votantes
  fecha como "não aprovada"; teste com relógio falso.
- **Dependências:** MO.6.1, MO.6.2.

### MO.6.4 · Voto, elegibilidade e crédito mensal
- **Descrição:** `CastVoteUseCase`: exige posição no snapshot (nunca bot), plano PRO **ou** crédito
  do mês disponível; consome 1 crédito só no primeiro voto da assembleia (mudar o voto até o fechamento
  não consome outro; PRO não consome). Crédito por mês de calendário (fuso de Brasília). Exige e-mail
  verificado e nível mínimo para o crédito.
- **Aceite:** testes de cada ramo (PRO, crédito, sem crédito, sem posição, bot, voto repetido,
  mudança de voto); `403 { error: 'requer plano PRO ou crédito de voto' }`; `.docs/backend/assemblies.md`.
- **Dependências:** MO.6.1, MO.2.4.

### MO.6.5 · Propostas de pauta e apoio
- **Descrição:** catálogo `agenda_templates` (tipo, opções com ganho/perda e efeito). PRO propõe uma
  pauta do catálogo para uma empresa que possui e apoia as dos outros; as mais apoiadas entram na
  próxima assembleia, respeitando o cooldown. Teto de propostas por PRO por mês.
- **Aceite:** sem texto livre; testes de ordenação por apoio, teto e cooldown.
- **Dependências:** MO.6.1, MO.6.4.

### MO.6.6 · Telas (frontend)
- **Descrição:** lista de assembleias, detalhe com **ficha da pauta** (as duas opções com ganho e
  perda e a faixa de efeito, sem recomendar lado), **placar ao vivo** (polling curto, cache Redis),
  botão de voto com o saldo de crédito para o gratuito e convite ao PRO sem pressão, resultado e
  histórico. Linguagem de narrativa do app, nunca "vocês são o Banco Central".
- **Aceite:** três breakpoints; placar atualiza em segundos sem WebSocket; nenhum texto de escassez.
- **Dependências:** MO.6.4.

### MO.6.7 · O mundo reage
- **Descrição:** resultado vira notícia (módulo `news`), item no feed social e, para acionistas, e-mail
  opt-in no `notifications`. XP pequeno e conquista "Acionista ativo" **só por participar**.
- **Aceite:** nada é concedido por estar no lado vencedor; e-mail idempotente por assembleia.
- **Dependências:** MO.6.3.

### MO.6.8 · Admin: pausa, auditoria e parâmetros
- **Descrição:** no painel admin: pausar/retomar assembleias (padrão das pausas de negociação), ver
  votos e resultado com auditoria, editar parâmetros (mínimo de votantes, duração, faixas de efeito,
  cooldown, nível mínimo) e o catálogo de pautas.
- **Aceite:** pausa impede abertura e aplicação sem perder estado; `.docs/backend/admin.md` atualizado.
- **Dependências:** MO.6.3.

### MO.6.9 · Calibração antes de ligar
- **Descrição:** simular em escala (catálogo e usuários sintéticos maiores que os de hoje, diretriz
  "projetar para crescer") o efeito acumulado das assembleias nos fundamentos, no preço (via reação
  dos bots) e no ranking; ajustar faixas e cooldown. Ligar por variável de ambiente, desligado por
  padrão.
- **Aceite:** relatório com os números e as faixas escolhidas; nenhuma empresa sai de uma faixa
  plausível em 12 meses simulados; ranking não é dominado por quem segura a empresa decidida.
- **Dependências:** MO.6.2, MO.6.3.

---

## Fase G — Crescimento e medição

### MO.7.1 · Funil e painel de conversão
- **Descrição:** eventos do funil (MO.1.3) e uma visão no painel admin: assinantes ativos, mensal x
  anual, churn mensal, receita recorrente estimada, conversão por ponto de convite e por âncora.
- **Aceite:** números batem com o painel do RevenueCat numa amostra.
- **Dependências:** MO.2.3, MO.1.3.

### MO.7.2 · Indicação entre amigos
- **Descrição:** amigo que assina por indicação dá dias de PRO para os dois, via concessão
  promocional (MO.2.5), com teto por pessoa. Usa o grafo de amizade existente.
- **Aceite:** abuso básico bloqueado (mesma conta, teto); recompensa confirmada pelo autor antes.
- **Dependências:** MO.2.5, MO.7.1.

### MO.7.3 · Teste de preço e desconto do anual
- **Descrição:** com dados reais, avaliar anual a ~17% contra 25 a 30% e a faixa do mensal; só mexer
  no preço pela configuração dos produtos.
- **Aceite:** decisão registrada com os números.
- **Dependências:** MO.7.1 e volume de assinantes suficiente.

---

## Fase H — Adiado, não abrir tarefa

| Item | Por que adiado | Condição para reabrir |
|---|---|---|
| Assembleia dos Investidores (voto decide Selic ou taxação setorial, afeta o mercado todo) | Autor adiou; o desenho da Fase F já é extensível por `kind` | MO.6.1 pronto e Fase F validada; precisa fazer `selic.NextCalendarRate` aceitar um resultado externo |
| Máquina do tempo (cenários sob demanda) | Não pode reusar o disparo de evento macro global; decisão entre sandbox roteirizado e ambiente novo | Decisão de produto e sinal de demanda |
| Múltiplas carteiras | Desacopla `Account` de `UserID` no motor, maior risco do projeto; pergunta aberta sobre qual carteira entra no ranking | Sessão própria de levantamento no `engine/` + resposta do autor |
| Conselho PRO (voto na próxima trilha/funcionalidade) | **Autor decidiu que não entra** | Só se o autor reabrir |
| Cripto, opções e derivativos como mercado jogável | Não é o centro do PRO; exigem trabalho grande no motor e cuidado de tom (alavancagem gamificada) e regulatório | Demanda comprovada; cripto primeiro |
| Trilhas de conteúdo extras PRO e acesso antecipado | Conteúdo puro vende mal; o que é útil e gratuito (Trilha F) continua grátis | Se vierem junto de um mercado avançado (lição + simulação) |
| Remoção de anúncios | Não há anúncios | Só se anúncio virar fonte de receita |

---

## Sequência sugerida

`MO.1.1 → 1.3 → 2.1 → 2.2 → 2.3 → 2.4 → 3.1 → 3.2 → 3.3 → 5.1 → 5.2 → 1.2 → 3.4 → 2.5 → 5.3 → 5.4 → 5.5 → (app) 4.1 → 4.2 → 4.3 → 4.4 → 7.1 → 6.1 → 6.2 → 6.3 → 6.4 → 6.5 → 6.6 → 6.7 → 6.8 → 6.9 → 7.2 → 7.3`

Racional: fundação e web primeiro, porque RevenueCat em sandbox valida o desenho inteiro sem o app.
Identidade e ligas vêm antes por serem a base social que vende o PRO. A Fase F fica depois da
medição (MO.7.1) porque só vale construir a Assembleia, a mais cara, quando houver sinal de
interesse e assinantes para votar; a MO.6.9 antecede ligar qualquer efeito no mercado real. Termos e
fiscal (MO.1.2) precisam estar prontos **antes de cobrar de verdade**, não antes de desenvolver.
Nenhuma cobrança real sai sem MO.1.2, MO.2.5 (reconciliação) e, no caso do app, MO.4.4.
