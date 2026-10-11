# Backlog — Monetização (assinatura PRO, B2C, multiplataforma)

Backlog executável derivado de `.claude/estrategia-monetizacao.md` (produto) e
`.claude/analise-tecnica-monetizacao.md` (técnica), com as decisões fechadas pelo autor em
**2026-10-10**. Mesma relação que `backlog-app-mobile.md` tem com o documento de arquitetura dele:
os dois documentos são o "porquê"; este arquivo quebra em tarefas, uma por sessão.

## Decisões fechadas (2026-10-10)

| # | Decisão |
|---|---|
| M1 | **B2C puro.** Turmas/escolas (B2B) estão fora do plano. |
| M2 | ~~Assinatura em todas as plataformas: web, Android e iOS.~~ **Revisada em 2026-10-10 (LW1): lançamento só na web.** Android e iOS ficam adiados (Fase D congelada); o desenho multiplataforma continua válido e o código nativo já feito fica inerte. Ver `backlog-lancamento-web-pwa.md`. |
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

**Decisão de 2026-10-10 (LW2):** o **RevenueCat continua** como camada única mesmo só com a web (Stripe conectado, M12); só reavaliar a troca por Stripe direto se o custo mensal incomodar. **Para o lançamento, MO.1.1 vale só para a web** (sem Apple/Google; ver LW.4.1) e **MO.5.6 vira navegador + PWA instalado** (LW.5.1).

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
> **Reescopo (2026-10-10):** no lançamento só web, valem apenas Stripe + RevenueCat (LW.4.1). Apple Developer e Google Play ficam para quando o app voltar.
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
- **Rascunhos prontos (2026-10-11), para revisão do contador, não publicados:** `rascunho-termos-assinatura-pro.md`, `rascunho-politica-reembolso-pro.md` e `rascunho-privacidade-operadores-pro.md`, com os `[PREENCHER ...]` que dependem do autor.

### MO.1.3 · Medição mínima antes de vender ✅ (2026-10-10)
- **Descrição:** hoje não há telemetria. Sem funil não dá pra ajustar preço nem upsell.
- **O que fazer:** escolher a ferramenta (a decidir, respeitando LGPD e o RNF09: nada de patrimônio
  absoluto em evento), e instrumentar o funil mínimo: lição concluída → viu paywall → iniciou
  compra → assinou → cancelou. Detalhado na MO.7.1; aqui só a decisão da ferramenta.
- **Aceite:** ferramenta escolhida e registrada.
- **Dependências:** nenhuma.
- **Entregável:** **decisão do autor (2026-10-10): eventos próprios no Postgres**, sem ferramenta de terceiro. Motivos: nenhum dado de usuário sai da plataforma (sem consentimento extra nem conta nova), serve direto ao painel da MO.7.1 e não depende das contas de loja/RevenueCat. Alternativa descartada: PostHog ou similar (dashboards prontos, mas dado a terceiro, aviso na Política de Privacidade e ainda precisaria de painel próprio). Regra mantida: evento só tem quem, passo, ponto de convite e plano, nunca patrimônio absoluto (RNF09) nem valor em reais.

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

## Fase D — App mobile: compra nativa ⏸ ADIADA (2026-10-10, lançamento só na web)

**Congelada:** não abrir MO.4.x enquanto o app nativo estiver adiado. As tarefas já entregues (MO.4.1 a MO.4.3)
permanecem no repositório e **inertes na web**; a LW.1.3 garante por teste que nada disso aparece fora do app.
MO.4.4 (sandbox das lojas e checklist de revisão) volta junto do app.

Todas tocam `mobile/` e dependem da Fase 1 do `backlog-app-mobile.md` (app rodando). Ver a
arquitetura do app para a ponte WebView.

### MO.4.1 · SDK de compras no app ✅ parcial (2026-10-10: camada + falsa em debug; real sem conta)
- **Descrição:** `react-native-purchases` (RevenueCat) configurado por plataforma; `logIn(userId)`
  quando a sessão do app é estabelecida e `logOut` ao sair.
- **Aceite:** em build debug, o app lista o Offering `default` no log e o `app_user_id` coincide com
  `users.id`.
- **Dependências:** `backlog-app-mobile.md` 2.1 (ponte de sessão), MO.1.1.

- **Entregável:** `mobile/purchases/`: interface `PurchasesService` (`logIn`, `logOut`, `listPlans`, `purchase`, `restore`, `managementUrl`), implementação real `revenueCatPurchases` (única que importa `react-native-purchases@10.12.2`; operações de sessão em fila, nunca compra como anônimo, cancelamento do usuário não é erro), implementação falsa `fakePurchases` e a fábrica `createPurchasesService`, escolhida por `PURCHASES_MODE` (`.env.debug` = `fake`, `.env.release` = `revenuecat`; chaves `REVENUECAT_ANDROID_API_KEY`/`REVENUECAT_IOS_API_KEY` em branco). `App.tsx` faz `logIn(users.id)` (lido do `sub` do JWT guardado) quando a sessão é estabelecida e `logOut` ao sair. **Segurança do falso:** (a) a fábrica só o devolve com `__DEV__`, em release `fake` vira "indisponível"; (b) ele grava por `POST /billing/dev/purchase`, rota que só existe com `BILLING_PROVIDER=dev`, e a configuração do backend **recusa a subida** com `REVENUECAT_SECRET_KEY` ou `EMAIL_PROVIDER=resend` (NODE_ENV não serve: a imagem Docker sempre roda com `production`, achado ao subir o compose; a primeira versão da guarda usava NODE_ENV e derrubava o desenvolvimento local); (c) o produto gravado tem prefixo `dev.fake.` e os preços exibidos levam o sufixo "(teste)". O SPA não precisa distinguir: a barreira é o servidor. Backend: novo provedor `dev` (`DevSubscriptionUseCase`, `POST /billing/dev/purchase`, `DELETE /billing/dev/subscription`, documentados em `.docs/backend/billing.md`); `billingEnabled` é true também nele. **Test Store do RevenueCat:** a documentação confirma que funciona sem conta de loja, mas exige projeto e chave no RevenueCat (que também não existem) e o SDK derruba o app se a chave de Test Store for usada em release, por isso não foi usado. Testes: 8 do backend novos, 25 novos no mobile (jest). **Pendente (precisa de conta):** conferir o adaptador real contra o RevenueCat (Offering `default` com pacotes mensal/anual, `app_user_id` = `users.id` no painel, log do Offering em debug), instalar os pods no iOS (`pod install`, só em macOS).

### MO.4.2 · Ponte WebView ↔ compra nativa ✅ (2026-10-10; sem emulador/loja, ver pendências)
- **Descrição:** o SPA detecta que roda no app (flag injetada) e, em vez de abrir o checkout web, envia
  `{ type: 'purchase', plan: 'monthly' | 'annual' }` por `postMessage`; o app chama a compra
  nativa e devolve `{ ok | cancelled | error }`; o SPA refaz o polling de status.
- **Aceite:** compra em sandbox no emulador/dispositivo resulta em PRO na tela; usuário cancelando a
  folha de pagamento volta sem erro; nenhum link de pagamento web aparece dentro do app.
- **Dependências:** MO.4.1, MO.3.1.

- **Entregável:** protocolo único `selucra:purchases-request` com `requestId` e `op` (`plans|purchase|restore|manage`); resposta pelo evento `window` `selucra:purchases-response` com `status` `ok|cancelled|error` (e `reason` `unavailable|failed`). **Desvio do enunciado** (`{ type: 'purchase', plan }`): um tipo namespaced com campo `op`, no padrão das outras pontes. Lado app: `mobile/purchasesBridge.ts` (parse estrito, `handlePurchasesRequest` que nunca lança, injeção segura da resposta, `userIdFromToken`, plataforma injetada em `window.__selucraNative`) ligado ao `onMessage` de `App.tsx`. Lado SPA: `features/billing/nativePurchases` implementa a **mesma porta** `WebPurchases` da compra web (planos, compra), então `usePurchaseFlow` e a tela `/planos` não mudaram de forma: `useWebPurchases` devolve a nativa dentro do app e o SDK web no navegador. Compra sem limite de tempo (a pessoa fica na folha da loja), pedidos rápidos com limite de 20 s (app antigo sem a ponte cai em erro). **Preços vêm da loja** (as lojas exigem; `/planos` no app não usa texto nosso). `ProInvite` e `/planos` dentro do app agora abrem a compra nativa (antes só texto); nenhum link de pagamento web no app. **Conferência prévia:** `usePurchaseFlow.start` consulta `GET /billing/status` antes de abrir a folha de pagamento e não compra se já for PRO (cobre assinatura por outra plataforma e tela desatualizada); se a consulta falha, não compra. Corrigido de passagem: com cobrança ligada mas sem meio de compra no ambiente (navegador sem chave pública), a tela ficava em "Carregando preços" para sempre; agora mostra "ainda não está disponível". Testes: 8 de `nativePurchases`, 2 de `App` e 22 de `purchasesBridge` no mobile, 3 novos de `usePurchaseFlow`, 2 de `Planos`.

### MO.4.3 · Restaurar compras e gerenciar por loja ✅ (2026-10-10; loja real pendente)
- **Descrição:** botão "Restaurar compras" (exigido pelas lojas), link de gerenciar assinatura da
  loja correta, e comportamento claro quando o mesmo usuário assinou em outra plataforma.
- **Aceite:** reinstalar o app e restaurar devolve o PRO; conta com assinatura em outra loja não
  oferece nova compra (evita cobrança dupla).
- **Dependências:** MO.4.2, MO.3.3.

- **Entregável:** `/planos` dentro do app tem "Restaurar compras" (porta `WebPurchases.restore`, só na ponte nativa): se a loja devolve direito ativo, reaproveita a espera de confirmação do servidor; se não há nada, explica (sem erro) que quem assinou por outro caminho vê o PRO ao entrar com a mesma conta; timeout e erro têm texto próprio de restauração. **Assinou em outra plataforma:** `describePlan(status, inApp, platform)` e a tela "Você já é PRO" mostram "Você assinou pela web / App Store / Google Play. O seu PRO já vale aqui no app, não é preciso assinar de novo."; como quem é PRO nunca vê planos e `usePurchaseFlow.start` reconfere o servidor antes da folha de pagamento (MO.4.2), não há como comprar por cima. **Gerenciar:** no app o botão de "Seu plano" não é link, é `manage` pela ponte: o app prefere o `managementURL` do SDK e senão a URL da loja enviada pela página, aceita só `https` de `apps.apple.com` e `play.google.com`, e abre no navegador do sistema. Para assinatura da loja do outro sistema (App Store vista no Android) segue o link da loja certa mais o aviso. Web vista no app: só instrução textual (sem link do portal). **Validado no emulador Android (API 35, build debug real, backend em `BILLING_PROVIDER=dev`):** login no WebView, `/planos` com os dois planos "(teste)", Restaurar sem assinatura (mensagem explicativa), Assinar mensal (banco gravou `play_store`/`monthly`/`dev.fake.monthly` e a tela virou "Você já é PRO"), "Seu plano" com "Assinado pelo Google Play" e o botão de gerenciar abrindo `play.google.com` no navegador do sistema. Esta validação cobre também a MO.4.1 e a MO.4.2 no Android com a implementação falsa (o app compilou com `react-native-purchases` linkado). **Bug de fundo achado e corrigido na validação:** a ponte de sessão do app lia a chave `tcc.auth.token`, que a RC.1.4 renomeou para `app.auth.token` no SPA; o Keychain nunca recebia o token e a camada de compras ficava sem `logIn`. A chave foi atualizada (com teste que a trava) e o watcher agora também avisa a sessão que já existia ao carregar a página. **Pendente (precisa de conta/loja/aparelho):** (a) restaurar com o RevenueCat real, incluindo conferir a regra de transferência de compras entre usuários no painel (comportamento "transfer if no active subscription"); (b) reinstalar o app e restaurar o PRO de verdade; (c) assinatura cruzada real (Stripe na web, depois abrir o app; Play Store, depois iOS); (d) as duas URLs de fallback das lojas ainda não conferidas na documentação; (e) toda a parte iOS (`pod install`, StoreKit, `apps.apple.com`), junto da Fase 4 do app; (f) a passada visual de `/planos` no app em 320 e 768 px, junto da MO.4.4 (só 390 px foi vista). **Resíduo:** a conta de teste criada no emulador deixou uma linha em `accounts` do banco `market` (a tabela de eventos é append-only por gatilho, não dá para apagar o rastro); o usuário e a assinatura foram removidos do banco `gamification`.

### MO.4.4 · Teste em sandbox e checklist de revisão das lojas ⏸ adiada com o app
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

### MO.5.5 · Convite contextual para o PRO ✅ (2026-10-10)
- **Descrição:** onde o convite aparece, sempre dispensável e sem repetição agressiva: criar liga ou
  duelo, perfil/cosméticos, a retrospectiva, a assembleia (Fase F) e uma linha opcional no resumo
  semanal por e-mail (respeitando o opt-in). Pode incluir o teste de interesse "tenho interesse" por
  âncora antes de construir a seguinte, medido pelo funil da MO.7.1.
- **Aceite:** nenhum convite bloqueia ação do core loop; dispensar lembra a escolha; revisado contra
  `proposta-engajamento-licoes.md`.
- **Dependências:** MO.5.1, MO.3.1.

- **Entregável:** só frontend (sem rota nova). Molécula `components/molecules/ProInvite` (props `context`, `title?`, texto como filho): some para quem já é PRO e com `billingEnabled=false` (consulta o status do plano ela mesma, uma regra só), é dispensável pelo botão "Agora não" e lembra a escolha em `localStorage` por **contexto** durante **30 dias** (`features/billing/proInviteDismissal`, chave nova `app.proInvite.dismissed` em `STORAGE_KEYS`, JSON `{contexto: timestamp}`, leitura tolerante a valor corrompido e a armazenamento indisponível). Dentro do app (`isNativeApp()`) não renderiza o link para `/planos`, só o texto neutro e a dispensa. Substituiu os convites fixos de `LeagueCreateForm`, `DuelChallengePanel`, `CosmeticsPicker` e `RetrospectiveReport` (esta perdeu a prop `billingEnabled`); em liga e duelo o convite carrega o título da seção, que some junto ao dispensar. Nenhum convite fica no caminho de ação do core loop. Texto sem culpa, sem escassez e sem travessão (revisado contra `proposta-engajamento-licoes.md`). Testes: módulo de dispensa, molécula (PRO, cobrança desligada, dispensa, 30 dias, app nativo) e os quatro consumidores.
  - **Fora do escopo desta entrega (de propósito):** o convite da **assembleia** (nasce com a Fase F), a **linha opcional no resumo semanal por e-mail** (precisa do opt-in de engajamento da `backlog-email.md`) e o teste "tenho interesse" por âncora (precisa do funil da **MO.7.1**).

### MO.5.6 · Validação completa da Fase E no WebView, em resolução mobile ✅ parcial (2026-10-10: navegador; app pendente)
- **Descrição:** a Fase E foi conferida no navegador do desktop e, pontualmente, em 390 px. Esta tarefa
  valida **tudo da fase dentro do app** (React Native + WebView, Android primeiro, iOS quando houver
  ambiente) em resolução de celular, porque o WebView muda coisas que o navegador esconde: área segura
  (notch e barra de gestos), teclado cobrindo formulário, `navigator.share`/download de arquivo, canvas,
  toque em vez de passar o mouse, rolagem e a `TabBar` fixa embaixo.
- **O que validar (roteiro, uma passada por tela, com conta gratuita e com conta PRO):**
  - **Identidade (5.1):** seletor em Configurações (molduras e títulos tocáveis, sem corte), selo/moldura/título
    no ranking, na lista e busca de amigos, no feed e no perfil público; cancelar o PRO esconde, reativar volta.
  - **Ligas (5.2):** `/ligas` (convite, criar, lista), `/ligas/:id` (classificação sem quebrar o nome longo,
    botão "Tirar", convidar amigo, renomear, encerrar, sair), convite aceito por conta gratuita; liga pausada.
  - **Duelos (5.3):** `/duelos` (convite, desafiar, em andamento, histórico), `/duelos/:id` (placar lado a lado
    legível em tela estreita, aceitar, recusar, cancelar), item de duelo no feed.
  - **Retrospectiva (5.4):** `/retrospectiva` (troca de mês, calendário de dias, cartões), **compartilhar a imagem**:
    confirmar se o menu de compartilhar abre no WebView; se não abrir, se o download funciona, e se não funcionar,
    abrir a pendência na tarefa 2.x do app (download de arquivo) e **registrar o desvio aqui**; conferir a imagem
    gerada (1080x1350) no aparelho.
  - **Convites ao PRO (5.5):** aparecem, dispensam e lembram a escolha; **nenhum link de pagamento web dentro do
    app** (regra das lojas): o convite no app não pode levar a `/planos` com checkout web, e sim ao fluxo nativo
    da Fase D ou a uma mensagem neutra enquanto a Fase D não existir.
  - **Geral:** 3 breakpoints continuam corretos fora do app (320, 390, 768, 1024 px); sem rolagem horizontal; alvos de
    toque de pelo menos 44 px; texto sem travessão e sem jargão; tema claro e escuro; rede lenta e offline (mensagens
    de erro amigáveis); girar a tela.
- **Aceite:** roteiro executado e registrado (data, aparelho/emulador, versão do app, o que passou e o que falhou
  com captura de tela); todo defeito encontrado corrigido ou aberto como tarefa/ponto em aberto com dono; compartilhar
  imagem com desfecho definido (funciona, ou fallback documentado); checklist assinado antes de a Fase E ser dada como
  pronta para publicação.
- **Dependências:** MO.5.1 a 5.5; `backlog-app-mobile.md` Fase 1 (app rodando no emulador) e, para o compartilhar/baixar
  imagem, a tarefa de download de arquivo (Fase 2). A parte de compra nativa (MO.4.x) não entra aqui.

- **Entregável (parte feita, 2026-10-10, sem o app):** como o app ainda não roda, a passada foi no **navegador**, com o frontend em iframes de 320, 390 e 768 px (media queries reais), backend com a cobrança ligada (`BILLING_PROVIDER=revenuecat` com chaves de mentira, só leitura de status) e duas contas de teste, uma gratuita e uma PRO (linha em `subscriptions`). Tudo revertido ao fim: contas anonimizadas por `DELETE /me`, assinatura apagada, backend reiniciado com a configuração padrão, Vite parado.
  - **Passou:** `/ligas`, `/duelos` e `/configuracoes` nos 3 tamanhos sem rolagem horizontal; convite ao PRO aparece para a conta gratuita e some para a PRO (que vê o formulário de criar liga e o de desafiar); alvos de toque do convite com pelo menos 44 px; sem travessão; dispensar esconde na hora e a escolha persiste ao recarregar (`{"duel": timestamp}` na chave `app.proInvite.dismissed`).
  - **Defeito achado e corrigido:** o convite era um `<aside>` dentro do `<aside>` da página (landmark aninhado e `aria-label` repetido); virou `<div>`.
  - **Achado fora do escopo:** o link "Privacidade e LGPD" em Configurações tem 17 px de altura (abaixo de 44 px). Não é da Fase E; fica como ajuste pequeno em Configurações.
  - **Não deu para validar no navegador e fica para o app:** convite sem link para `/planos` dentro do WebView (coberto só por teste unitário, a injeção de `ReactNativeWebView` não sobrevive à navegação do iframe); `/retrospectiva` com relatório (conta nova não tem mês fechado, o job é mensal; os cartões e a imagem ficam cobertos por teste unitário); menu de compartilhar/baixar a imagem 1080x1350 no WebView, área segura, teclado cobrindo formulário, toque, girar a tela, tema claro, rede lenta/offline, selo/moldura/título nas telas sociais com duas contas amigas, liga e duelo em andamento, ligas pausadas por cancelamento.
  - **Reescopo (2026-10-10):** sem app no lançamento, o que sobra vira a **LW.5.1** (navegador e PWA instalado, 320/390/768 px, mais o link de 17 px); o emulador só volta com o app. Texto original abaixo.
  - **Pendente para fechar a tarefa:** repetir o roteiro completo no emulador Android quando a Fase 1 do app estiver rodando (e o download de arquivo da Fase 2 para a imagem). Só então a Fase E está pronta para publicação.

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
- **Prazos e crédito (autor, 2026-10-10):** abre 2 dias depois do balanço, dura 7 dias, o efeito começa 1 dia depois de fechar; o crédito mensal exige nível 3 e e-mail verificado. Tudo em configuração.
- **Mínimo de votantes distintos** (configurável, ponto de partida 3); abaixo disso a pauta não passa
  e nada muda. Empate mantém o status quo.
- **Pautas de um catálogo fechado, de dois lados** (cada opção tem ganho e perda), sem texto livre e
  sem curadoria humana. PRO propõe pautas; as mais apoiadas entram na próxima assembleia da empresa.
- **Efeito só nos fundamentos**, nunca no preço direto: o preço continua vindo da negociação dos
  bots reagindo. Efeito limitado em faixa, aplicado de forma gradual, no máximo uma mudança por
  empresa por trimestre.
- **Sem recompensa por vencer:** XP e conquista só por participar.
- **Extensível:** o desenho trata a assembleia como um `kind`; só `shareholder` entra agora.

### MO.6.1 · Fundação genérica de assembleia (backend) ✅ (2026-10-10)
- **Descrição:** módulo `assemblies` (DDD lite). Domínio: `Assembly` (`kind`, `subject_ref`,
  `opens_at`, `snapshot_at`, `closes_at`, `effect_applies_at`, `status`), `AgendaOption`, `Vote`.
  Três políticas por `kind`, escolhidas por uma tabela de registro em `application/` (sem `if kind`
  espalhado): `EligibilityPolicy`, `WeightPolicy`, `EffectApplier`. Implementação inicial só de
  `shareholder`. Tabelas: `assemblies`, `assembly_options`, `assembly_votes`, `assembly_vote_credits`.
- **Aceite:** testes de domínio table-driven (peso entre votantes, mínimo de votantes, empate,
  mudança de voto até fechar); adicionar um `kind` fictício nos testes sem alterar o núcleo; lint de
  camadas verde.
- **Dependências:** MO.2.4.

- **Entregável:** módulo `backend/src/modules/assemblies` (DDD lite), tabelas `assemblies`, `assembly_options`, `assembly_votes` e `assembly_vote_credits` (migração `0042`, `when` do journal conferido acima da anterior; `.docs/backend/assemblies.md`). **Sem rotas HTTP nesta tarefa:** cada uma entra com o caso de uso que a justifica (6.4, 6.5, 6.6, 6.8). **Núcleo** em `domain/assembly.ts`: `tallyVotes` (peso e elegibilidade pela política do kind sobre o snapshot; descarta voto inelegível ou fora da pauta antes de contar o mínimo; abaixo do mínimo ou empate no topo mantém o status quo), `isOpenForVoting`, `validateNewAssembly` (corte <= abertura < fechamento <= efeito, 2 opções ou mais), `creditMonthKey` (mês em Brasília) e `hasFreeCredit`. **Extensão por kind:** `AssemblyKindRegistry` com `KindPolicies` puras (`isEligible`, `weightOf`) e `EffectApplier` (ponto de saída para o motor); `shareholder` = posição no snapshot e peso em ações. Um kind fictício (`investor_macro`, peso 1) nos testes prova que o núcleo não muda. **Casos de uso:** `CreateAssemblyUseCase` (idempotente por `dedupe_key`, então reexecutar o job de abertura não duplica) e `TallyAssemblyUseCase` (apuração sem gravar, serve ao placar e ao fechamento). **Repositório Drizzle:** `upsertVote` trava a linha da assembleia, então voto e fechamento se serializam e nenhum voto entra depois da apuração; `markOpen` e `close` são transições condicionais ao estado. **Ports declaradas:** `AssemblyRepository` e `HoldingsSnapshotProvider` (adapter HTTP do motor na MO.6.3). **Decisões minhas, para sua revisão:** (a) o peso do voto não é gravado, sai do snapshot na apuração; (b) crédito mensal como linha por pessoa e assembleia (consumo idempotente), com `monthlyFreeCredits` como parâmetro (hoje 1, M8); (c) parâmetros entram por função e `DEFAULT_ASSEMBLY_PARAMS` (3 votantes, 1 crédito) é só o ponto de partida até a tabela editável da MO.6.8; (d) `scheduled | open | closed` como estados, resultado em colunas da própria assembleia. Testes: 33 unitários (domínio table-driven e casos de uso com fakes) e 4 de integração em Postgres descartável (abertura idempotente, janela de voto, fechamento único, crédito); lint, build e testes verdes. **Não feito:** o `docker compose up` de ponta a ponta não se aplica (sem rota nem job ligado; o módulo ainda não é composto em `app.ts`, entra com a MO.6.3/6.4). Nota: a suíte inteira de integração num banco compartilhado já falha de forma intermitente por vazamento entre arquivos (FK de `users` em tabelas de outros módulos, muda de arquivo a cada ordem de execução); o arquivo novo cria e remove só os próprios usuários e passa em qualquer ordem.

### MO.6.2 · Motor: data de corte e decisão como evento (Go) ✅ (2026-10-10)
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

- **Entregável:** pacote `engine/internal/domain/corporategovernance` (funções puras de efeito, rampa e cooldown; `Service`; interface `Repository` pequena declarada no domínio), adapter `db.GovernanceRepository`, migração `000051`, rotas `POST/GET /governance/snapshots` e `POST/GET /governance/decisions` (`.docs/engine/governance.md`), gancho `tick.Service.WithGovernance`. **Snapshot:** foto das posições na primeira chamada, só contas de usuário (`is_bot` fora), ações somadas entre ON e PN, idempotente pelo id da assembleia (vender depois do corte não muda a foto; empresa sem acionista gera snapshot vazio estável). **Decisão:** numa transação travada pela assembleia e pela empresa, **grava primeiro o evento `assembly_decision` em `market_events`** (conta técnica de governança, `reference_id` = assembleia, `quantity` = mudança total em centésimos) e só então a decisão; repetir devolve a original sem novo evento. **Efeito só nos fundamentos:** mexe em `companies.base_growth_pct` ou `quality_multiplier`, nunca em cotação (provado em teste). Mudança total = `direction × faixa × intensity`, em centésimos inteiros, então a rampa linear de N ticks **fecha exatamente no total** e recuperar ticks em lote dá o mesmo resultado de um por vez; sem sorteio (RNF08). **Cooldown** por empresa em dias simulados: a decisão em cooldown fica registrada (evento com quantidade 0) e nada muda; fora da faixa válida do cadastro idem. **Aplicação** no tick, antes de ler as empresas, transacional e idempotente (`applied_ticks`); falha na governança é logada e **nunca derruba o tick**. **Parâmetros em `enginesetting`** (4 chaves novas editáveis em runtime: faixa de crescimento, faixa de qualidade, rampa e cooldown; padrões 0,50 p.p., 0,05, 30 ticks e 90 dias). **Ajustes em código existente:** `market_events.reference_id` (o event store grava), `assembly_decision` conhecido pela verificação de integridade (não move caixa), conta técnica criada sob demanda e excluída da contagem de bots do painel, e o backend filtra as chaves `governance_*` da listagem de parâmetros do painel até a MO.6.8 (senão a tela 10.11 quebraria). Testes: domínio table-driven (efeito, soma da rampa para totais, rampas e saltos variados, cooldown, plano, serviço com fake), rotas HTTP, gancho do tick e **integração em Postgres descartável** (snapshot, evento antes do efeito, idempotência, cooldown, rampa dia a dia, cotação intocada); `golangci-lint` 0 issues, `go build`, `go test ./...` (inclusive integração) e backend verdes. **Validado de ponta a ponta com o binário real do motor** (imagem do Dockerfile) contra Postgres descartável, nunca o banco dev (o evento é imutável e não se reverte): migrações aplicam do zero, snapshot sem o bot, decisão `201` e depois `200` com um só evento, efeito inválido `400`, e dois ticks reais aplicaram +0,02 e +0,03 na empresa (rampa de 30 ticks para +0,50). **Decisões minhas, para sua revisão:** (a) **exceção ao achado 029**, que fechava a lista editável do `enginesetting` só no ritmo do Temporizador: segui o texto desta tarefa ("parâmetros em `enginesetting`, nunca fixos") e a instrução da sessão; (b) os dois botões de fundamento escolhidos como "efeito" (crescimento e qualidade) e a faixa padrão pequena; (c) peso do voto = ações de **todas as classes** somadas (ON e PN contam igual); (d) o motor recebe a decisão **já aprovada** (o backend decide quem venceu e envia só o efeito), então "não aprovada" nunca chega ao motor; (e) o efeito começa no tick seguinte ao recebimento da decisão, então é o backend (MO.6.3) quem escolhe o instante de enviá-la (em `effect_applies_at`). **Não feito:** o Calendário de mercado ainda não mostra a decisão (entra na MO.6.3 com o ciclo); tela dos parâmetros no painel (MO.6.8); adapter HTTP do backend para `HoldingsSnapshotProvider` e para enviar a decisão (MO.6.3); calibração das faixas em escala (MO.6.9).

### MO.6.3 · Ciclo de vida: abrir, fechar e aplicar ✅ (2026-10-10)
- **Descrição:** job que abre a assembleia alguns dias depois do balanço da empresa (evento já no
  Calendário), pede o snapshot ao motor (port `HoldingsSnapshotProvider`), fecha na data prevista,
  apura, envia a decisão ao motor e marca o resultado. O resultado fica **público antes** de o
  efeito valer (próximo ciclo). Entra no Calendário como evento de mercado.
- **Aceite:** reexecução do job não duplica abertura nem decisão; assembleia sem mínimo de votantes
  fecha como "não aprovada"; teste com relógio falso.
- **Dependências:** MO.6.1, MO.6.2.

- **Entregável:** o ciclo inteiro roda em job (`RunAssemblyLifecycleUseCase`: fechar, abrir e aplicar, nessa ordem, cada etapa independente e idempotente), **desligado por padrão** (`ASSEMBLIES_ENABLED=on` liga, de hora em hora). **Motor:** rota nova `GET /governance/reports?min_days=&max_days=` (`.docs/engine/governance.md`), que devolve o último balanço já divulgado de cada empresa (com `sector` e tickers) via `paymentschedule.DaysSinceReport`, porque o `report` do Calendário é global e sem empresa; `corporategovernance.RecentReports` é função pura testada. **Backend:** `OpenDueAssembliesUseCase` (pega balanços de 2 a 9 dias simulados atrás, escolhe a pauta de forma determinística por hash de empresa e dia do balanço, cria por `dedupe_key = shareholder:{empresa}:{dia do balanço}`, tira o snapshot no motor e abre; retoma a que ficou `scheduled` por falha no meio), `CloseDueAssembliesUseCase` (apura com o snapshot; sem mínimo de votantes ou empate fecha `not_approved`; motor fora do ar deixa aberta), `ApplyDueAssemblyEffectsUseCase` (só aprovadas, em `effect_applies_at`, envia a decisão **já aprovada** ao motor e marca `effect_applied_at`; não aprovada nunca chega ao motor). Adapters HTTP do motor para as ports `HoldingsSnapshotProvider` (que ganhou `take`), `CompanyReportSource` e `EffectApplier` do `shareholder`; `server.ts` liga o scheduler e `app.ts` o Calendário. **Catálogo de pautas semeado e expansível:** tabela `agenda_templates` (migração `0043`, `when` do journal acima da `0042`), 5 pautas gerais e 12 de setor (Varejo, Energia, Mineração, Agronegócio, Bancário/Financeiro, Tecnologia), cada uma de dois lados com ganho e perda, efeito só em crescimento ou qualidade, sem texto livre; escrita a partir da estrutura real de AGO (destinação do lucro, orçamento de capital do art. 196 da Lei das S.A., política de endividamento) e de decisões típicas de cada setor. Cresce por linha nova; a MO.6.5 acrescenta proposta e apoio e a MO.6.8 a edição no painel. **Calendário:** `assembly_open`, `assembly_close` e `assembly_effect` entram como fatos globais de mercado (sem valor em reais, fora do `scope=mine`, falha nunca derruba o calendário); só aparecem com o ciclo ligado. `assemblies` ganhou `title`, `subject_label`, `template_key` e `effect_applied_at`. Parâmetros por variável de ambiente (`ASSEMBLY_OPEN_DELAY_DAYS` 2, `ASSEMBLY_CATCH_UP_DAYS` 7, `ASSEMBLY_DURATION_DAYS` 7, `ASSEMBLY_EFFECT_DELAY_DAYS` 1, `ASSEMBLY_MIN_VOTERS` 3) até a tabela do painel (MO.6.8). Testes: 7 arquivos novos ou ampliados no backend (domínio, casos de uso com relógio falso e fakes, adapters com `fetch` simulado, config, Calendário, 4 testes de integração em Postgres descartável incluindo a validação do catálogo semeado) e, no motor, domínio table-driven, rota HTTP e integração do `ListCompanySchedules`; `golangci-lint` 0 issues, `go test ./...`, backend `lint`, `build` e `npm test` verdes. **Validado de ponta a ponta com o binário real do motor** (imagem do Dockerfile) contra Postgres descartável, nunca o banco dev: `GET /governance/reports` achou o balanço do dia 91 aos 2 dias, a rodada abriu a assembleia com snapshot de 3 acionistas, a reexecução não duplicou, 3 votos aprovaram, o efeito foi enviado uma vez (`201` no motor, evento `assembly_decision` com `reference_id` da assembleia, rampa de 30 ticks a partir do dia 94) e as rodadas seguintes não repetiram nada. **Decisões minhas, para sua revisão:** (a) **unidades dos prazos:** o atraso de 2 dias depois do balanço conta dias simulados (é o que o motor conhece), e duração (7) e atraso do efeito (1) contam dias reais (é o prazo que a pessoa vive ao votar); com o ritmo atual do Temporizador (`days_per_real_day` > 1) 2 dias simulados são menos de 1 dia real, então vale conferir na MO.6.9; (b) pauta escolhida por hash determinístico, sem repetir-evitar a anterior da mesma empresa (o cooldown de 90 dias do motor já espaça os efeitos; a ordenação por apoio é da MO.6.5); (c) janela de recuperação de 7 dias para o job que ficou parado (balanço mais antigo que isso não abre assembleia); (d) a data de corte é o instante da abertura. **Pendências:** (1) **antes de ligar `ASSEMBLIES_ENABLED`, o frontend precisa conhecer os tipos `assembly_*`** (hoje `CalendarKindIcon` indexa um mapa por tipo e quebraria com um tipo novo); entra na MO.6.6, por isso a flag nasce desligada e o Calendário só os serve ligada; (2) sem rota HTTP ainda (voto na 6.4, telas na 6.6), então a validação foi de ciclo, não de tela; (3) calibração das faixas e do ritmo é a MO.6.9.

### MO.6.4 · Voto, elegibilidade e crédito mensal ✅ (2026-10-10)
- **Descrição:** `CastVoteUseCase`: exige posição no snapshot (nunca bot), plano PRO **ou** crédito
  do mês disponível; consome 1 crédito só no primeiro voto da assembleia (mudar o voto até o fechamento
  não consome outro; PRO não consome). Crédito por mês de calendário (fuso de Brasília). Exige e-mail
  verificado e nível mínimo para o crédito.
- **Aceite:** testes de cada ramo (PRO, crédito, sem crédito, sem posição, bot, voto repetido,
  mudança de voto); `403 { error: 'requer plano PRO ou crédito de voto' }`; `.docs/backend/assemblies.md`.
- **Dependências:** MO.6.1, MO.2.4.

- **Entregável:** primeiras rotas do módulo `assemblies`: `POST /assemblies/:id/vote` (`201` primeiro voto, `200` troca) e `GET /assemblies/:id/me` (situação da pessoa: `canVote`, `reason`, `message`, voto atual, ações próprias na data de corte, saldo do crédito), documentadas em `.docs/backend/assemblies.md`. **Regra pura** em `domain/voting.ts` (`resolveVoteAccess`, table-driven), usada por um só `VoteAccessService` que serve ao voto e à leitura: janela, posição no snapshot (bot nunca tem, o motor o exclui; vale também para PRO), troca de voto livre, PRO vota sem crédito, e só então e-mail verificado, nível mínimo e saldo do mês. **PRO só via `ProAccessGuard`** (adapter em processo `inProcessProStatus`, que traduz `PRO_REQUIRED` em `false` e deixa qualquer outro erro propagar). **Atomicidade:** `AssemblyRepository.castVote` grava voto e consome o crédito numa transação com a assembleia travada e a pessoa travada no mês (advisory lock), então voto recusado nunca gasta crédito, voto e fechamento se serializam e dois votos simultâneos em assembleias diferentes gastam um crédito só (testado em Postgres real). Parâmetros `ASSEMBLY_MONTHLY_FREE_CREDITS` (1) e `ASSEMBLY_FREE_CREDIT_MIN_LEVEL` (3). **Rotas e ciclo só existem com `ASSEMBLIES_ENABLED=on`:** o módulo agora é composto uma vez em `app.ts` (router + job via `app.locals.runAssemblyLifecycle`, que `server.ts` lê); desligado, as rotas dão 404. Testes: domínio table-driven, casos de uso com fakes (PRO, crédito, sem crédito, sem posição, e-mail, nível, voto repetido, troca depois de perder o PRO, fora da janela, corrida com o fechamento, virada de mês), rotas via supertest, adapters, config, `app.test` ligado/desligado e 5 de integração do `castVote` (incluindo concorrência); lint, build e `npm test` verdes. **Decisões suas aplicadas** (respondidas antes de codar): `403` por motivo com `reason`, troca de voto livre mesmo sem PRO, rotas de voto mais "minha situação", crédito do mês do primeiro voto. **Não feito:** `docker compose up` de ponta a ponta (a chave nasce desligada e a rota depende de assembleia aberta, que só o ciclo com motor real cria; o ciclo foi validado na 6.3 e o voto em Postgres real aqui); listar assembleias e placar são da 6.6.

### MO.6.5 · Propostas de pauta e apoio ✅ (2026-10-10)
- **Descrição:** catálogo `agenda_templates` (tipo, opções com ganho/perda e efeito). PRO propõe uma
  pauta do catálogo para uma empresa que possui e apoia as dos outros; as mais apoiadas entram na
  próxima assembleia, respeitando o cooldown. Teto de propostas por PRO por mês.
- **Aceite:** sem texto livre; testes de ordenação por apoio, teto e cooldown.
- **Dependências:** MO.6.1, MO.6.4.
- **Entregável:** **Backend:** tabelas `agenda_proposals` (uma proposta ativa por empresa e pauta, índice único parcial) e `agenda_proposal_supports` (migração `0044`, `when` do journal acima da `0043`); domínio puro em `domain/proposals.ts` (`rankProposals`, `pickProposedTemplate`, `resolveProposalAccess`, mês de Brasília do teto); port `ProposalRepository` (adapter Drizzle transacional: duplicado e teto serializados por advisory lock), `CompanyStandingReader` (motor) e `ProGate` (o `ProAccessGuard`, nunca claim de JWT); casos de uso `ProposeAgenda`, `SupportProposal`, `WithdrawProposalSupport` e `ListCompanyProposals`; quatro rotas novas (`GET` e `POST /assemblies/companies/:companyId/proposals`, `PUT` e `DELETE /assemblies/proposals/:proposalId/support`) em router próprio, tudo atrás de `ASSEMBLIES_ENABLED`. `OpenDueAssembliesUseCase` agora expira a fila vencida, escolhe a proposta mais apoiada e cai no sorteio por hash do catálogo quando nenhuma serve; a proposta que virou pauta é consumida de forma idempotente. **Motor:** rota nova `GET /governance/companies/{id}/standing?user_id=` (posição de agora e dias de cooldown que faltam), com `CooldownDaysLeft` como função pura testada (`.docs/engine/governance.md`). **Decisões do autor (2026-10-10):** teto de 3 propostas por PRO por mês; só PRO com posição de agora apoia (o proponente conta como o primeiro apoio); desempate pela proposta mais antiga; a mais apoiada (mínimo 2 apoios) vence e senão vale o hash, a vencedora é consumida e as demais seguem na fila até expirar em 30 dias reais, sem zerar a cada ciclo; só o cooldown do motor, avisado na entrada (propor e apoiar recusam `company_in_cooldown`); pauta já na fila vira apoio e não gasta o teto; apoio é retirável (sem exigir PRO), proposta só expira, e o teto não é devolvido. Parâmetros `ASSEMBLY_PROPOSAL_MONTHLY_CAP`, `ASSEMBLY_PROPOSAL_MIN_SUPPORT` e `ASSEMBLY_PROPOSAL_TTL_DAYS` até a MO.6.8. Nunca se revela quem propôs ou apoiou. **Testes:** domínio (ordenação, desempate por data e id, mínimo, expiração, mês de Brasília), casos de uso com fakes (teto, duplicado, cooldown, acionista, PRO, retirada), ciclo de abertura com proposta, adapter do motor com `fetch` simulado, router via supertest e 6 testes de integração em Postgres descartável (duplicado e teto sob concorrência); no motor, domínio table-driven, rota HTTP e integração do repositório. `golangci-lint` 0 issues, `go test ./...`, backend `lint`, `build` e `npm test` verdes. **Validado com o binário real do motor** (imagem do Dockerfile) contra Postgres descartável: dono com ações, sem ações, em cooldown (60 dias que faltam), `404` e `400`. **Pendências:** (1) sem tela ainda (a 6.6 consome `GET .../proposals`, que já devolve o que ela precisa); (2) o ponto 050 (abertura de assembleia com a empresa ainda em período de espera, e unidades do prazo da fila x cooldown) segue em aberto para a MO.6.9; (3) a validação completa do backend contra o motor real em ciclo (abrir com proposta vencedora) ficou nos testes de caso de uso e integração, não de ponta a ponta.

### MO.6.6 · Telas (frontend) ✅ (2026-10-10)
- **Descrição:** lista de assembleias, detalhe com **ficha da pauta** (as duas opções com ganho e
  perda e a faixa de efeito, sem recomendar lado), **placar ao vivo** (polling curto, cache Redis),
  botão de voto com o saldo de crédito para o gratuito e convite ao PRO sem pressão, resultado e
  histórico. Linguagem de narrativa do app, nunca "vocês são o Banco Central".
- **Aceite:** três breakpoints; placar atualiza em segundos sem WebSocket; nenhum texto de escassez.
- **Dependências:** MO.6.4.
- **Entregável:** **Backend (commit próprio, a leitura que faltava):** `GET /assemblies` (abertas e histórico, filtro por empresa) e `GET /assemblies/:id` (ficha da pauta, placar, resultado público depois do fechamento), com placar de assembleia aberta em **cache Redis de 5 s** (`assemblies:scoreboard:{id}`, Redis fora do ar nunca derruba a leitura); placar só em % das ações de quem votou e contagem de votantes, nunca ações absolutas, valor em reais nem voto por pessoa (RNF09); a ficha traz o efeito de cada opção como `{métrica, sentido, intensidade}`, sem valor absoluto. **Frontend:** serviços e hooks (`services/assemblies`, `features/assemblies`), páginas `/assembleias` (lista: abertas agora e encerradas, com explicação de como funciona) e `/assembleias/:id` (ficha com os dois lados com o mesmo peso visual, ganho, perda e o que a opção mexe sem recomendar lado; placar por **polling de 6 s**; voto e troca de voto; resultado: aprovada com a opção, sem quórum ou empate dizem que nada muda; "Sua situação" com ações na data de corte e saldo do voto gratuito), seção "Assembleias de acionistas" **na página da empresa** com a lista, as últimas encerradas e o `ProposalsPanel` da MO.6.5 (apoiar, retirar apoio, propor do catálogo, teto do mês e período de espera em texto), seção em **Notícias** com atalho para a votação aberta e **ponto no sino** enquanto houver assembleia aberta ainda não vista (`unreadAssemblies`, localStorage de ids), item "Assembleias" no menu do avatar, e os marcos `assembly_open/close/effect` no **Calendário** (ícone, rótulo e legenda; pendência 1 da MO.6.3 resolvida). Tudo some quando o servidor responde 404 (recurso desligado): menu, sino, Notícias, empresa e a própria lista mostram aviso em vez de tela quebrada. **Convite ao PRO** com o `ProInvite` contextual (origem nova `assembly` no funil: migração `0045` troca a CHECK de `funnel_events.source`, `when` acima da `0044`, e os rótulos do painel e `.docs/backend/billing.md` acompanham), só quando falta crédito de voto e no painel de propostas; quem não tem ações vê o motivo em texto e nenhum convite. **Decisões do autor (2026-10-10):** entrada pela página da empresa + lista própria + Calendário, e também em Notícias/sino; placar parcial em % das ações e nº de votantes enquanto aberta; convite contextual só nos casos sem acesso. **Responsivo:** mobile em coluna (a situação da pessoa vem antes das opções), tablet com as duas opções lado a lado, desktop ≥ 1024 px com composição própria (ficha larga à esquerda e "Sua situação" fixa à direita; na lista, as regras fixas à direita; na empresa, a seção ocupa a largura toda da grade). **Testes:** backend (domínio do placar, casos de uso com fakes e cache, router, adapter Redis, `listPublic` em Postgres descartável), frontend 29 testes novos (textos, ponto do sino, lista, detalhe com voto/troca/sem crédito/sem ações/aprovada/sem quórum/404, propostas, Notícias, empresa, calendário); `npm test` 2105 passando, `tsc -b`, `build`, `lint` do frontend e `lint`, `build` e `npm test` do backend verdes. **Pendências:** (1) **não validado visualmente** nos três breakpoints nem contra o backend com `ASSEMBLIES_ENABLED=on` (sem dados de assembleia no ambiente): fica para a MO.6.9; (2) o sino acende por assembleia aberta nova, sem saber ainda se a pessoa pode votar nela (o direito vem de `GET /assemblies/:id/me`, por assembleia); (3) notificação de **resultado** (assembleia encerrada) não acende o sino, só aparece em Notícias; (4) polling de 6 s é por aba aberta, sem WebSocket (como pedido).

### MO.6.7 · O mundo reage ✅ (2026-10-10)
- **Descrição:** resultado vira notícia (módulo `news`), item no feed social e, para acionistas, e-mail
  opt-in no `notifications`. XP pequeno e conquista "Acionista ativo" **só por participar**.
- **Aceite:** nada é concedido por estar no lado vencedor; e-mail idempotente por assembleia.
- **Dependências:** MO.6.3.
- **Entregável:** **Decisões do autor (2026-10-10):** (1) **notícia** continua só na seção "Assembleias de acionistas" de Notícias, que já lista as encerradas com o desfecho (`AssemblyCard`), então não mudou o contrato de `GET /news` nem o motor; (2) **feed social**: amigos aceitos de **quem votou** veem "Fulano participou da assembleia de X: pauta", **sem o voto** e sem o desfecho no texto (o desfecho fica nos dados), e a linha entra **no fechamento**, não no momento do voto (não revela quem está votando enquanto aberta); (3) **e-mail**: todo acionista da data de corte, tenha votado ou não, na categoria **`social` já existente** (opt-in, desligada por padrão, sem categoria nova), inclusive quando a assembleia fecha **sem decisão** (texto neutro, nunca cobra participação); (4) **XP**: **10, uma vez por assembleia** (primeiro voto; trocar o voto não concede de novo), parâmetro `ASSEMBLY_PARTICIPATION_XP`; (5) **conquista "Acionista Ativo"**: votar em **3 assembleias distintas**, critério novo `assemblies_participated`. **Backend:** migração `0046` (journal `when` 1793800000000: valor novo no enum `achievement_criteria_type` e coluna `assemblies.result_announced_at`). **4ª etapa do ciclo**, `AnnounceClosedAssembliesUseCase`: fechadas sem `result_announced_at`; publica o feed (quem votou) e o e-mail (acionistas elegíveis do snapshot) em lotes de 25, cada envio **idempotente** (`assembly-result:<assembleia>:<pessoa>` no outbox; `recordAssemblyParticipation` com `WHERE NOT EXISTS` no feed); se um envio falha a assembleia não recebe a marca e a rodada seguinte repete sem duplicar. Três ports novas em `assemblies/application/ports/resultPublishers.ts` (`ResultFeed`, `ResultMailer`, `ParticipationRewards`) com adapters em processo para `socialfeed`, `notifications` e `gamification` (composição em `app.ts`). `CastVoteUseCase` concede o XP no primeiro voto, best-effort (voto já gravado). `socialfeed`: tipo `assembly_participated` e `assembly` no item. `achievements`: critério novo no domínio, catálogo, snapshot (`countVotedAssemblies`, conta mesmo com o recurso desligado) e seed (só com `ASSEMBLIES_ENABLED=on`). `notifications`: template `assembly_result`. Nada carrega voto por pessoa, peso nem valor em reais (RNF09). **Frontend:** `RecentActivityFeed` com a linha de assembleia (ícone `Landmark`), tipos de `socialfeed`, `achievements` e `admin`, rótulo de progresso da conquista. **Testes:** domínio, casos de uso com fakes (publicação, falha e repetição, quórum, XP uma vez, XP não derruba o voto), adapters, template, config, e integração em Postgres descartável (fila de publicação, marca única, contagem de votos distintos, feed idempotente); lint, build e `npm test` do backend (3879) e `tsc`, `oxlint` e suíte do frontend verdes. Docs: `assemblies.md`, `socialfeed.md`, `achievements.md`, `notifications.md`. **Pendências:** (1) **não validado de ponta a ponta** com `ASSEMBLIES_ENABLED=on` contra o motor real nem visualmente: fica para a MO.6.9; (2) a conquista só nasce com o seed rodado com o recurso ligado (o seed não roda na imagem hoje, ver `analise-ambiente-producao.md`); (3) assembleia fechada antes desta migração teria o resultado publicado de uma vez ao ligar (não há nenhuma em produção, o recurso nunca esteve ligado); (4) `ASSEMBLY_PARTICIPATION_XP` ainda não está no `.env.example` (arquivo com edições do autor não commitadas).

### MO.6.8 · Admin: pausa, auditoria e parâmetros ✅ (2026-10-11)
- **Descrição:** no painel admin: pausar/retomar assembleias (padrão das pausas de negociação), ver
  votos e resultado com auditoria, editar parâmetros (mínimo de votantes, duração, faixas de efeito,
  cooldown, nível mínimo) e o catálogo de pautas.
- **Aceite:** pausa impede abertura e aplicação sem perder estado; `.docs/backend/admin.md` atualizado.
- **Dependências:** MO.6.3.

- **Entregável:** **Decisões do autor (2026-10-11):** (1) **pausa global e por empresa**, que **impede abrir assembleia nova e aplicar efeito**; fechar, apurar, publicar o resultado e votar numa assembleia já aberta seguem (o prazo de voto é uma promessa a quem vota), e nada se perde: a pauta que ficaria agendada e o efeito pendente esperam e a rodada seguinte à retomada os entrega; (2) **auditoria:** o admin vê o **voto por pessoa** e o peso em ações, **sem auditar a leitura** (mesma exceção deliberada do patrimônio), e **toda escrita grava `admin_audit_log`** (ações novas `assembly.pause`, `assembly.resume`, `assembly.setting_update`, `assembly.setting_reset`, `assembly.template_create`, `assembly.template_update`, `assembly.template_activate`, `assembly.template_deactivate`); (3) **parâmetros em tabela** (`assembly_settings`), com a variável de ambiente como valor inicial, valendo **só para as próximas assembleias**; (4) **catálogo com edição completa e validação**, desativar em vez de apagar. **Backend:** migração `0047` (`when` 1793900000000, acima da `0046`): `assembly_settings`, `assembly_pauses` (uma vigente por escopo, índice único parcial) e `assemblies.min_voters` (o **quórum é congelado na abertura**: apuração e detalhe usam o dela, então baixar o mínimo no painel não decide uma votação em curso). No módulo `assemblies`: `domain/settings.ts` (11 parâmetros com faixa: mínimo de votantes, duração, espera depois do balanço, janela de recuperação, espera do efeito, crédito mensal, nível mínimo, XP, teto, apoios e validade das propostas), `domain/pause.ts`, `domain/agendaTemplates.ts` (2 a 4 opções, efeito só em crescimento ou qualidade, sentido 1 ou -1, intensidade em (0, 1], chaves únicas, **sem travessão** no texto que aparece no app); `AssemblySettingsService` mantém o objeto de configuração vivo (o mesmo que a composição já lia por função) e o relê ao gravar e **no começo de cada rodada do ciclo**; `OpenDueAssembliesUseCase` e `ApplyDueAssemblyEffectsUseCase` consultam as pausas (a global nem chama o motor); leitura com voto por pessoa e peso (`GetAdminAssemblyDetailUseCase`); adapters Drizzle de pausa (criar e retomar condicionais, a corrida entre dois admins decidida pelo índice), parâmetros e catálogo editável (com contagem de uso por assembleia e proposta). `createAssemblyAdminCore` na composição existe **mesmo com o recurso desligado**: parâmetros e pautas se calibram antes de ligar (MO.6.9). No `admin`: porta `AssemblyAdmin`, adapter em processo que traduz as recusas do módulo dono para 404, 409 e 422, 12 casos de uso (leituras sem auditoria, escritas auditadas), router com 12 rotas em `/admin/assemblies/*` (`.docs/backend/admin.md`, `.docs/backend/assemblies.md`); `POST /admin/assemblies/pauses` exige senha recente como a pausa de negociação. A governança do motor (faixa de efeito, rampa e cooldown, `enginesetting`) entra pelas rotas de parâmetros que já existiam: `GET /admin/settings?group=governance` e as mesmas `PUT`/`DELETE`, sem tocar o motor; o filtro `governance_*` da tela de Tempo virou filtro por grupo. **Frontend:** seção **Assembleias** no painel e quatro telas (`/admin/assembleias`: lista de todos os estados com efeito pendente e pausa, mais o painel de pausa, que no desktop fica ao lado da lista; `/admin/assembleias/:id`: quem votou em quê, com peso e voto descartado; `/parametros`: 11 do backend e 4 do motor com padrão, faixa e restaurar; `/pautas`: lista e editor com opções, métrica, sentido e intensidade), responsivas nos três breakpoints; pausa global pede digitar a confirmação, a de empresa pede o nome. **Testes:** domínio (faixas, sobreposição, escopos de pausa, validação de pauta), casos de uso com fakes (pausa, parâmetros, catálogo, auditoria, leitura), o ciclo com relógio falso (pausa global e por empresa em abrir e aplicar, retomada, fechar segue, quórum congelado), fluxo completo do router com os casos de uso reais sobre fakes, borda HTTP dos erros, adapter do grupo de governança, integração em Postgres descartável (pausa concorrente e retomada concorrente, parâmetros, catálogo com uso, quórum gravado) e, no frontend, auxiliares, serviços e as quatro telas; `npm run lint`, `build` e testes do backend verdes, `tsc -b`, `oxlint` e suíte do frontend verdes. **Validado de ponta a ponta com o stack real** (imagens do Dockerfile do backend e do motor, Postgres e Redis descartáveis, nunca o banco dev): migração `0047` aplicada no boot; parâmetros gravados, recusados fora da faixa (422) e auditados; o grupo de governança lido e gravado no motor; pauta criada e recusada com efeito inválido; pausa global criada (201), repetida (409) e, **com 12 balanços na janela, nenhuma assembleia abriu**; retomada, o ciclo abriu as 12 com `min_voters` 5; baixar o mínimo para 4 depois **não mudou** as abertas; pausa de uma empresa marcou só a dela. **Pendências:** (1) o painel só foi validado por teste de tela e pela API real, **não visualmente no navegador** nem nos 3 breakpoints (fica para a MO.6.9, junto da passada visual das telas de usuário); (2) o ponto **051** (balanço que sai da janela durante uma pausa nunca abre, parâmetros de voto que mudam com a votação aberta, setor de pauta em texto livre) segue em aberto; (3) o `.env.example` não ganhou `ASSEMBLY_*` (arquivo com edições do autor não commitadas); (4) a suíte inteira de integração num banco compartilhado segue falhando de forma intermitente por vazamento entre arquivos de outros módulos (nota da MO.6.1): o arquivo novo passa em qualquer ordem e em banco novo.

### MO.6.9 · Calibração antes de ligar (ensaio ✅ 2026-10-11; valores de lançamento aprovados 2026-10-11; recalibração depois da MO.6.15)
- **Descrição:** simular em escala (catálogo e usuários sintéticos maiores que os de hoje, diretriz
  "projetar para crescer") o efeito acumulado das assembleias nos fundamentos, no preço (via reação
  dos bots) e no ranking; ajustar faixas e cooldown. Ligar por variável de ambiente, desligado por
  padrão.
- **Aceite:** relatório com os números e as faixas escolhidas; nenhuma empresa sai de uma faixa
  plausível em 12 meses simulados; ranking não é dominado por quem segura a empresa decidida.
- **Decisão do autor (2026-10-11, ponto 046 item 3):** os parâmetros ainda abertos (mínimo de
  votantes, faixas de efeito, cooldown, tamanho do catálogo de pautas) saem **deste teste ponta a
  ponta**: o relatório mede o efeito dos pontos de partida e propõe os valores finais. Os pontos
  049, 050 e 051 também se revisam aqui (ver `pontos-em-aberto-decisao-produto.md`).
- **Dependências:** MO.6.2, MO.6.3.
- **Entregável (2026-10-11):** ensaio ponta a ponta em stack descartável (imagens do Dockerfile, Postgres e Redis novos, nunca o banco de dev), scripts em `tmp/ensaio-assembleia/` e relatório em `tmp/relatorio-calibracao-assembleia.md`. **Passou:** ciclo completo com relógio avançado (fechar, apurar, efeito 1 dia depois, rampa que fecha exata, feed, e-mail opt-in, XP uma vez, conquista "Acionista Ativo"); elegibilidade (`not_shareholder`, `email_not_verified`, `level_too_low`, `no_credit`, `not_open`), troca de voto, crédito do mês do primeiro voto e sob concorrência (30 votos simultâneos, 2 assembleias ao mesmo tempo); quórum, empate e maior peso; propostas (PRO, acionista, teto 3, duplicada vira apoio, retirar sem PRO, fila, consumo e expiração); cooldown (ponto 050) e pausas por empresa e global (ponto 051); motor fora do ar na apuração e no efeito, etapa interrompida (`scheduled` retomada), publicação que falha no meio com reinício do backend, Redis fora do ar; painel (parâmetros só para as próximas, catálogo, voto por pessoa, auditoria); recurso desligado devolve 404; telas de usuário e do painel no navegador real (390, 820 e 1280 px). **Bugs achados e corrigidos:** motor fora do ar devolvia `500` (agora `503 engine_unavailable`) e o proxy do Vite de dev não conhecia `/assemblies`. **Calibração (200 usuários, 84 empresas, 364 dias, dois controles):** ver o relatório; resumo: nenhuma empresa passa de +0,91 p.p. de crescimento nem +0,09 de qualidade (máx. 2 decisões por empresa por ano pelo cooldown), o efeito no ranking está dentro do ruído entre dois controles idênticos, e a proposta é **manter** os pontos de partida (0,50 p.p., 0,05, rampa 30, cooldown 90, mínimo 3) e crescer o catálogo para 25 ou mais. **Achado novo (ponto 053):** 33 das 34 opções do catálogo empurram o fundamento para cima, então o mercado deriva para cima; decisão do autor. **Não gravei nenhum valor final como padrão.** Ligar `ASSEMBLIES_ENABLED` em produção segue só com a sua autorização.

### Fase F2 — A assembleia decide o que o motor faz com o lucro, não só os indicadores (criada 2026-10-11)

**Origem:** na revisão do ponto 053 o autor notou que a pauta "reinvestir ou distribuir" contradizia a mecânica: o motor paga **50% do lucro** de toda empresa em todo balanço (`dividend.DefaultEquityPayoutRatio`, constante global), então decidir "não pagar" não mudava o dividendo da semana seguinte. Decisões do autor (2026-10-11):
- **Payout por empresa**, decidido em assembleia (valor inicial 50%, para não mudar o comportamento de hoje).
- **Efeito composto: até 2 efeitos por opção, em alavancas diferentes** (ex.: reinvestir = payout menor **e** crescimento maior). Resolve também a limitação de "um efeito por opção" do ponto 053.
- **Alavancas desta rodada:** payout, **política de dividendo** (trimestral, semestral ou anual; `companies.dividend_policy` já existe) e **prêmio da PN sobre a ON** (`pn_dividend_premium_pct`, piso legal de 10%). **Fora (melhoria futura, ponto 054):** recompra e emissão de ações.
- **Sem pagamento no meio da votação:** a empresa com assembleia de destinação do lucro **adia a declaração do dividendo** do balanço até a votação fechar e a decisão ser gravada. Sem quórum ou empate, vale o payout vigente. Dividendo já declarado antes continua no calendário dele.

**Mecanismo proposto (a confirmar na MO.6.11, antes de codar):** a declaração é do motor e acontece no dia do balanço, antes de o backend saber de qualquer coisa. Então quem adia é o **motor**: no dia do balanço, se a empresa é elegível (governança ligada, tem acionista, a alavanca de payout fora de cooldown), ele **não declara** e registra uma declaração pendente (lucro do ciclo e dia do balanço). O backend vê a pendência (`GET /governance/pending-declarations`), abre a assembleia de destinação do lucro e, ao fechar, a decisão chega ao motor, que **libera** a declaração com o payout novo (ou o vigente). Rede de segurança no motor, não no backend: pendência sem solução em N dias simulados (padrão a calibrar) é declarada com o payout vigente, e o painel tem um botão de liberar. Assim, motor ou backend fora do ar, assembleia desligada ou pausada nunca deixam o dividendo preso. Datas ex e de pagamento contam a partir do dia da liberação.

### MO.6.10 · Motor: payout por empresa e efeito composto
- **Descrição:** coluna `companies.payout_ratio_pct` (migração nova, padrão 50, faixa 0 a 100) lida por `dividend.EquityValuePerShare` no lugar da constante; `corporategovernance.Effect` vira lista de até 2 efeitos em métricas distintas; nova métrica `payout_ratio_pct` (degrau em p.p., faixa e rampa próprias como parâmetros em `engine_settings`).
- **Aceite:** o dividendo do ciclo usa o payout da empresa; empresa sem decisão paga igual a hoje (50%); decisão com 2 efeitos grava **um** evento `assembly_decision` com as duas linhas e aplica os dois; soma dos passos da rampa fecha exata (centésimos inteiros, RNF08); testes table-driven; `.docs/engine/governance.md`.
- **Dependências:** MO.6.2.

### MO.6.11 · Motor: declaração pendente e liberação
- **Descrição:** o mecanismo descrito acima: declaração pendente no dia do balanço, `GET /governance/pending-declarations`, liberação pela decisão (ou sem decisão), prazo de segurança e rota administrativa de liberação.
- **Aceite:** com assembleia aberta nenhum dividendo novo da empresa sai; ao decidir, sai com o payout novo e datas contadas da liberação; sem decisão sai com o vigente; pendência expirada sai sozinha; reexecução idempotente; teste determinístico.
- **Dependências:** MO.6.10.

### MO.6.12 · Motor: política de dividendo e prêmio da PN como efeito discreto
- **Descrição:** efeitos que **trocam** um valor (política trimestral, semestral ou anual; prêmio da PN com piso de 10%) em vez de somar um degrau, sem rampa, aplicados na liberação da declaração; respeitam a agenda de `paymentschedule`.
- **Aceite:** trocar a política muda quais balanços pagam; prêmio da PN nunca abaixo do piso legal; testes.
- **Dependências:** MO.6.10.

### MO.6.13 · Backend: catálogo, validação e abertura de assembleia de destinação do lucro
- **Descrição:** `agenda_templates.options[].effects` (lista de até 2, retrocompatível com o `effect` único), validação (`validateTemplateInput`, painel e proposta), `readEffectPreview` mostrando todos os efeitos na ficha da pauta, abertura a partir da declaração pendente (porta nova no motor), liberação no fechamento (inclusive sem quórum) e no caso de assembleia desligada ou pausada.
- **Aceite:** assembleia desligada, pausada ou sem pauta de destinação libera a declaração com o payout vigente; `.docs/backend/assemblies.md` e `admin.md`; checklist do backend.
- **Dependências:** MO.6.11.

### MO.6.14 · Frontend: ficha da pauta com efeitos compostos e aviso de dividendo adiado
- **Descrição:** a ficha mostra os 2 efeitos de cada opção sem recomendar lado; a tela do ativo avisa "o dividendo deste balanço depende da assembleia em andamento"; painel de pautas e parâmetros aceitam o formato novo. Três breakpoints, sem travessão.
- **Dependências:** MO.6.13.

### MO.6.15 · Pautas com troca real (fecha o ponto 053) e nova calibração
- **Descrição:** o catálogo de 28 pautas rascunhado em `tmp/pautas/` passa a usar efeitos compostos e as três alavancas, vira migração (dado no banco), e a calibração de 12 meses roda de novo, agora incluindo o payout (renda real do usuário), antes de dar o ponto como fechado.
- **Aceite:** relatório novo aprovado pelo autor; nenhuma empresa sai de faixa plausível, nem no payout; ranking não dominado.
- **Dependências:** MO.6.10 a MO.6.14.

---

## Fase G — Crescimento e medição

### MO.7.1 · Funil e painel de conversão ✅ (2026-10-10, aceite com o RevenueCat pendente)
- **Descrição:** eventos do funil (MO.1.3) e uma visão no painel admin: assinantes ativos, mensal x
  anual, churn mensal, receita recorrente estimada, conversão por ponto de convite e por âncora.
- **Aceite:** números batem com o painel do RevenueCat numa amostra.
- **Dependências:** MO.2.3, MO.1.3.
- **Entregável:** **Backend:** tabela `funnel_events` (migração 0041, idempotente por `dedupe_key`); ports `FunnelRecorder`/`FunnelReader`, adapter Drizzle, `RecordFunnelEventUseCase`, `GetBillingConversionUseCase`; domínio puro `funnel.ts` (métricas, chave por pessoa/evento/origem/dia, mapeamento do ciclo de vida). `subscribed` e `cancelled` são gravados só pelo servidor, a partir dos mesmos fatos dos e-mails de boas-vindas e de encerramento (`SyncSubscriptionUseCase` e a compra falsa `dev`); conta de teste das lojas e concessão promocional não geram evento nem entram nas métricas. Rotas `POST /billing/funnel` (3 passos do cliente) e `GET /admin/billing/conversion?days=7|30|90` (só admin), em `.docs/backend/billing.md`. Preços para a receita estimada só por configuração (`BILLING_PRICE_MONTHLY_CENTS`/`BILLING_PRICE_ANNUAL_CENTS`, no compose); sem eles a receita fica em branco, nunca um valor fixo no código. **Frontend:** `useReportFunnel` (dispara e esquece, uma vez por visita), `ProInvite` reporta o convite visto e passa o ponto de origem no estado do link, `/planos` reporta `plans_opened` (origem ou `direct`; não conta quem já é PRO) e `purchase_started` com o plano; página `/admin/assinaturas` (nova seção "Assinaturas") com assinantes por plano, receita estimada, churn, funil em barras e tabela por ponto de convite, 3 janelas, responsiva. "Lição concluída" no topo do funil vem do progresso das lições que já existe. Testes: backend (domínio, casos de uso, router, sync/dev, config, integração em banco descartável) e frontend (hook, `ProInvite`, `Planos`, página admin); lint, build e suíte completa verdes. **Validado de ponta a ponta** com o backend em `BILLING_PROVIDER=dev` e os preços configurados: eventos gravados (4 chamadas, 3 linhas, a repetida foi ignorada), compra falsa virou `subscribed`, `403` para quem não é admin, métricas conferidas por curl; dados de teste removidos e backend devolvido à configuração padrão. **Estimativas a saber:** o churn reconstrói a base (ativos de hoje - quem assinou + quem cancelou na janela); "assinou" por ponto é quem teve contato e assinou depois, e uma pessoa pode contar em mais de um ponto. **Pendente:** (a) o aceite "números batem com o painel do RevenueCat" exige a conta (MO.1.1); (b) a passada visual da página admin no navegador nos 3 breakpoints não foi feita (promover uma conta a admin no banco foi negado pelo ambiente nesta sessão); a tela tem teste de componente e a API foi conferida por curl, falta olhar a tela em 320/768/1024 px; (c) a Política de Privacidade deve citar a medição própria do funil antes de ir a produção (ver ponto 048).

### MO.7.2 · Indicação entre amigos ✅ (2026-10-11)
- **Descrição (decidida pelo autor em 2026-10-11, ponto 046 item 6):** qualquer pessoa, PRO ou
  não, indica por um link. Vale como indicação a conta **criada pelo link que verifica o e-mail**
  (ou entra com Google, que já vem verificado). A recompensa é **só de quem indica**, **sem teto de
  indicações**, e escala: conquistas por marco e dias de PRO, via concessão promocional (MO.2.5),
  por exemplo 5 indicações = 1 semana de PRO, 20 = mais 1 semana, 50 = mais uma, e assim por
  diante. Quem entra pelo link não ganha nada (ninguém recebe "PRO que já tem"). A escada de marcos
  é dado no banco, não código; os valores acima de 50 e as conquistas/molduras de cada marco o
  autor confirma ao abrir a tarefa.
- **Aceite:** cada conta indicada conta uma vez; auto-indicação (mesma conta) bloqueada; marco
  concedido uma única vez (idempotente); **defesa contra conta descartável**, já que o gatilho é
  só verificar o e-mail e a recompensa em PRO não tem teto: o desenho precisa propor um freio
  (ex.: contar só quem completa a primeira lição ou chega ao nível 2, limite de criações por IP)
  e o autor aprova antes de implementar.
- **Dependências:** MO.2.5, MO.7.1.
- **Entregável:** **Decisões do autor (2026-10-11, ponto 052):** a indicação só conta quando a pessoa indicada **conclui a primeira lição** (sem limite por IP; risco aceito); escada 5, 20 e 50 convites = 1 semana de PRO cada, e **+1 semana a cada 50** acima de 50, sem teto; cada marco libera **uma conquista e um título novo** (sem moldura). **Backend:** módulo `referrals` (DDD lite: domínio puro em `domain/referral.ts`, 3 casos de uso, ports, adapters Drizzle, router, composição) e migração `0049` (`when` 1794100000000: tabelas `referral_codes`, `referrals` com `referred_id` único e `CHECK referrer <> referred`, `referral_milestones` como dado, `referral_rewards` com chave `(pessoa, marco)`; enum `referrals_qualified`; coluna `cosmetic_items.unlock_referrals`; 3 títulos `Mensageiro`, `Embaixador`, `Patrono`). `GET /me/referral` (código gerado na primeira leitura). O código entra em `POST /auth/register`, `GET /auth/google?ref=` (viaja no `state` do OAuth) e `POST /auth/google/token`, e só vale quando a chamada **cria** a conta; código ruim é ignorado em silêncio. `AdvanceLessonUseCase` avisa o módulo pela port `LessonCompletionListener` (best-effort); `QualifyReferralUseCase` valida a indicação de forma condicional, cria os marcos alcançados, concede o PRO (serializado por indicador com advisory lock) e reavalia as conquistas. **PRO promocional:** `GrantPromotionalProUseCase` no `billing`, com adapter do RevenueCat (`POST /v1/subscribers/{id}/entitlements/{ent}/promotional` com `end_time_ms`, **conferido na documentação atual em 2026-10-11**), adapter `dev` e adapter desligado; o fim da concessão é gravado **antes** da chamada (repetir é duplicata para o provedor) e falha deixa o marco pendente para a próxima tentativa. Conquistas `referrals_qualified` 5/20/50 (seed) e títulos liberados por contagem (`CosmeticLockedError` vira `403`). **Frontend:** `/login?ref=` abre direto no cadastro e leva o código (também ao Google), página `/convidar` (link, copiar e compartilhar, progresso, escada) nos 3 breakpoints, item no menu do avatar, título bloqueado com o motivo no seletor de identidade. **Testes:** domínio table-driven, casos de uso com fakes (auto-indicação, conta contada uma vez, marcos, empilhar, falha do provedor, repetição), adapters (RevenueCat com `fetch` simulado), integração em Postgres descartável (constraints e 5 indicações concorrentes concedem 1 vez), auth, lições, cosméticos e frontend. **Validado de ponta a ponta** (stack real em containers descartáveis, billing `dev`): 6 cadastros com o código, 5 primeiras lições concluídas, PRO promocional de 7 dias, conquista e título liberados, 6º convite sem nova concessão. **Não validado:** o RevenueCat real (sem chave) e o login com Google real. **Pendente (MO.2.5):** só a tela do painel admin para conceder PRO, que reaproveita o mesmo caso de uso.

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

`MO.1.1 → 1.3 → 2.1 → 2.2 → 2.3 → 2.4 → 3.1 → 3.2 → 3.3 → 5.1 → 5.2 → 1.2 → 3.4 → 2.5 → 5.3 → 5.4 → 5.5 → 5.6 → (app) 4.1 → 4.2 → 4.3 → 4.4 → 7.1 → 6.1 → 6.2 → 6.3 → 6.4 → 6.5 → 6.6 → 6.7 → 6.8 → 6.9 → 7.2 → 7.3`

Racional: fundação e web primeiro, porque RevenueCat em sandbox valida o desenho inteiro sem o app.
Identidade e ligas vêm antes por serem a base social que vende o PRO. A Fase F fica depois da
medição (MO.7.1) porque só vale construir a Assembleia, a mais cara, quando houver sinal de
interesse e assinantes para votar; a MO.6.9 antecede ligar qualquer efeito no mercado real. Termos e
fiscal (MO.1.2) precisam estar prontos **antes de cobrar de verdade**, não antes de desenvolver.
Nenhuma cobrança real sai sem MO.1.2, MO.2.5 (reconciliação) e, no caso do app, MO.4.4.

**Atualização (2026-10-10):** com o lançamento só na web, a sequência efetiva é a de `backlog-lancamento-web-pwa.md`;
a Fase D e o trecho "(app) 4.1 → 4.4" desta lista ficam congelados, e a MO.4.4 deixa de ser exigência para cobrar.
