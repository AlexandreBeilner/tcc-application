# Análise técnica — implementação da estratégia de monetização

> **Status: análise técnica, não decisão fechada.** Depende de `.claude/estrategia-monetizacao.md`
> (proposta de produto) continuar como está até a seção 7 daquele documento ser resolvida — preço,
> nome do plano e "se a TCC comporta esse escopo" não são decididas aqui. Este documento responde
> só à pergunta seguinte, técnica: **se/quando o autor decidir abrir backlog pra monetização, o que
> precisa ser construído, em que ordem, e com que risco?** Nenhuma linha de código foi escrita a
> partir deste documento — é insumo pra uma sessão de planejamento futura decompor em tarefas de
> backlog de verdade (mesmo tratamento que `proposta-engajamento-licoes.md` recebeu antes de virar
> `backlog-engajamento-gamificacao.md`).
>
> Toda referência de arquivo/linha abaixo foi conferida no código real em 2026-09-09 (não é
> suposição sobre a spec) — se o código mudar depois, revalidar antes de reusar isto num backlog.

## 0. Revisão de 2026-10-10 — multiplataforma com RevenueCat (leia primeiro)

O autor fechou: assinatura em **web, Android e iOS**, B2C, planos mensal/anual sem trial, e
**RevenueCat** como camada única. Isso **substitui** o desenho "só Stripe" das seções 1, 4, 6, 7 e 8
abaixo; elas ficam como referência de conceitos (idempotência, corpo raw, reconciliação), mas o que
vale para implementar é o resumo desta seção e o `backlog-monetizacao.md`.

| Antes (seções 1 a 8) | Agora |
|---|---|
| Backend fala com o Stripe (`paymentGateway`, Checkout, Billing Portal) | Backend só fala com o **RevenueCat** (port `EntitlementProvider`, REST). Stripe, Apple e Google ficam atrás dele |
| `stripe_customer_id`, `stripe_subscription_id` | `app_user_id` do RevenueCat = **`users.id`**; sem coluna de cliente |
| Webhook do Stripe com assinatura e corpo raw | Webhook do RevenueCat autenticado por **cabeçalho secreto** (comparação em tempo constante); não exige corpo raw, mas o `express.json()` global continua ok |
| O evento carrega o estado | O evento é só **aviso**: o backend reconsulta a API REST e grava a projeção (robusto a eventos fora de ordem) |
| `status` espelha o Stripe | `isActive` é função pura: PRO se `expiresAt > now`; webhook de expiração perdido não deixa ninguém PRO para sempre |
| Tabela `subscriptions` com campos Stripe | `subscriptions` com `store` (stripe, app_store, play_store, promotional), `product_id`, `period`, `expires_at`, `will_renew`, `management_url` |
| Cancelar = Billing Portal do Stripe | Destino depende de `store` (portal web, ajustes da App Store, Play Store) |
| Compra só por redirect web | **No app, compra nativa** (`react-native-purchases`) via ponte WebView; **dentro do app nenhum link de pagamento web** (regra das lojas) |
| Preço no Price do Stripe | Preço nos produtos de cada loja + Offering do RevenueCat; nunca hardcoded |

Novidades de risco que a revisão traz:

- **Mesmo usuário assinando em duas plataformas** (cobrança dupla): a tela de planos e o app
  precisam checar o status antes de oferecer compra (MO.4.3).
- **Usuário anônimo comprando antes do login**: proibido; sempre `logIn(userId)` antes da compra,
  senão o entitlement fica preso a um ID anônimo (transferência entre contas é evento a tratar).
- **Reembolso e chargeback** chegam por canais diferentes em cada loja; o desenho só reage ao estado
  do entitlement no RevenueCat.
- **Dependência externa nova** (RevenueCat): fora do ar, o backend continua servindo a última
  projeção local; a reconciliação (MO.2.5) corrige depois. Operador novo na LGPD (MO.1.2).
- **Web (decidido em 2026-10-10):** Stripe conectado ao RevenueCat, sem Pix. O Checkout, o Customer Portal e os recibos são do Stripe; o backend só enxerga o RevenueCat. Limitações documentadas da integração: só preço recorrente por unidade; métodos com redirecionamento fora; cancelamento pode levar até 2 h para chegar ao RevenueCat.
- Itens das seções 9.4, 9.5 e 9.8 (carteiras, cenários, Assembleia dos Investidores) seguem válidos
  como análise, mas estão **adiados** (Fase H do backlog). A 9.9 foi substituída pela seção 0.1. As
  seções 9.2, 9.3, 9.6 e 9.7 foram reorganizadas pelo backlog: ligas e cosméticos viraram âncoras
  (Fase E); trilhas extras e acesso antecipado foram adiados. A contagem "33 lições" da seção 9.3 deve ser
  lida como "as lições centrais" (hoje mais de 40).

## 0.1 Assembleia de Acionistas — desenho técnico extensível (2026-10-10)

Substitui as seções 9.8 e 9.9 para a Assembleia de Acionistas (regras de produto em
`estrategia-monetizacao.md`, seção 5). A Assembleia dos Investidores (9.8) continua válida como
análise, adiada, e é o primeiro `kind` extra previsto.

**Quem faz o quê.** O PRO vive no backend, as posições vivem no motor. Então:

- **Backend, módulo `assemblies` (DDD lite):** dono do ciclo da assembleia, do catálogo de pautas, das
  propostas e apoios, dos votos, do crédito mensal e da apuração. Consulta o plano pelo caso de uso de
  status (seção 5), nunca por claim de JWT.
- **Motor (Go), pacote de governança:** dono do **snapshot de posições** na data de corte (só contas
  de usuário, `is_bot` fora) e da **aplicação do efeito** nos fundamentos. Recebe a decisão por
  endpoint **idempotente** pelo id da assembleia e a grava em `market_events` antes de qualquer
  efeito (regra de Event Sourcing), o que mantém o determinismo por seed (RNF08).
- **Fronteira:** o backend pede o snapshot por uma port (`HoldingsSnapshotProvider`), calcula o
  resultado com os pesos devolvidos e envia a decisão ao motor por outra port. Nenhum SQL do mercado
  no Node.

**Extensibilidade por `kind`.** `Assembly` carrega `kind` e `subject_ref` (empresa hoje, mercado
inteiro amanhã). Três políticas por kind, resolvidas por um registro (sem `if kind` espalhado):

| Política | `shareholder` (agora) | `investor_macro` (futuro) |
|---|---|---|
| Elegibilidade | posição no snapshot, nunca bot; PRO ou crédito do mês | PRO (ou crédito); sem posição |
| Peso | ações na data de corte, entre quem votou | 1 por conta |
| Efeito | ajuste limitado dos fundamentos da empresa | resultado entra como entrada de `selic.NextCalendarRate` ou evento macro setorial |

Adicionar um kind é implementar as três políticas e registrar; o núcleo (abrir, votar, apurar,
auditar) não muda. Um teste com um kind fictício deve provar isso.

**Pontos de atenção:**
- **Mínimo de votantes e data de corte** são regra de domínio testável, não de rota.
- **Parâmetros** (mínimo de votantes, duração, faixas de efeito, cooldown, nível mínimo do crédito)
  em configuração (`enginesetting` no motor, tabela de parâmetros no backend), nunca fixos.
- **Crédito mensal:** tabela própria, 1 por mês de calendário (fuso de Brasília), consumido no
  primeiro voto da assembleia; mudar o voto não consome outro; PRO não consome.
- **Anti-abuso:** snapshot na abertura (ninguém compra ação só para votar), e-mail verificado e nível
  mínimo para o crédito, bots excluídos.
- **Ranking:** como quem possui a ação ganha ou perde posição, o efeito tem faixa pequena, é gradual
  e tem cooldown; a calibração em escala (MO.6.9) é pré-condição para ligar em produção.
- **Placar ao vivo:** polling curto sobre contagem em cache Redis; sem WebSocket.
- **Pausa e auditoria no admin**, no padrão das pausas de negociação.

## 1. Por que Stripe e o que isso implica (superado pela seção 0 na parte de integração)

O autor já indicou Stripe como gateway. Conceitos do Stripe que este produto usa diretamente:

- **Customer**: um objeto Stripe por usuário que assina (criado no primeiro checkout, não no
  cadastro — a maioria dos usuários nunca assina). Guarda `stripe_customer_id` no nosso banco,
  nunca dado de cartão (PCI: cartão nunca toca nosso backend).
- **Product + Price**: um Product ("PRO"), um único Price recorrente mensal (BRL) — coerente com a
  decisão da seção 3 da estratégia ("uma assinatura, sem item avulso"). Nada de múltiplos SKUs.
- **Checkout Session** (hosted, `mode: subscription`): forma recomendada pra MVP — Stripe hospeda o
  formulário de pagamento, nosso frontend só redireciona e recebe de volta via `success_url`/
  `cancel_url`. Evita construir UI de cartão própria (Payment Element) nesta fase; migrar depois é
  possível sem reescrever o domínio de billing (a Session é só a forma de coletar o pagamento, o
  ciclo de vida da Subscription é o mesmo).
- **Subscription**: o objeto que representa "está pagando" — tem `status` (`active`, `past_due`,
  `canceled`, `unpaid`, etc.) e `current_period_end`. **A verdade sobre "usuário é PRO" mora na
  Subscription do Stripe, não em um booleano nosso decidido uma vez.** O nosso banco guarda uma
  cópia/projeção desse estado, sincronizada por webhook — nunca a fonte.
- **Billing Portal**: página hospedada pelo Stripe pra o assinante cancelar/trocar forma de
  pagamento/ver fatura, sem nós construirmos essas telas. Reduz drasticamente o escopo de frontend
  de billing (não precisa tela de "gerenciar assinatura" própria na v1, só um botão que abre o
  Portal).
- **Webhooks**: o mecanismo real de sincronização — o Checkout pode "dar sucesso" no browser e o
  webhook chegar depois (ou nem chegar na primeira tentativa; Stripe reenvia com backoff). **Nenhum
  código de liberação de feature pode depender só do redirect de sucesso do Checkout** — só o
  webhook confirma o estado real.
- **Test mode vs Live mode**: chaves e webhooks são pares completamente separados (`sk_test_*` /
  `sk_live_*`, cada um com seu próprio webhook signing secret). Ambiente de dev/CI usa test mode com
  os cartões de teste do Stripe; nunca live mode fora de produção.
- **Idempotência**: Stripe reenvia o mesmo evento de webhook mais de uma vez por garantia de
  entrega — o handler tem que ser idempotente (mesmo evento processado 2x não pode gerar 2 XP, 2
  liga criada, etc.). Ver seção 6.

Isso não é conhecimento genérico de "APIs de pagamento" — as três decisões acima (Checkout hosted,
Billing Portal, verdade no webhook) são o que definem a maior parte do escopo de backend/frontend
abaixo. Errar isso (ex.: confiar no `success_url` pra liberar o plano) é o bug de billing mais comum
em integrações Stripe e não é aceitável aqui — dinheiro real entra no primeiro dia de produção.

## 2. Decisões técnicas ainda em aberto (fora do escopo desta análise)

Documentado pra não ser redecidido do zero numa sessão futura, mas nenhuma tem resposta aqui:

- ~~Preço e moeda~~ **Decidido 2026-10-10:** BRL, mensal R$ 19,97 e anual R$ 199,97 (sujeito às faixas das lojas).
- ~~Trial gratuito~~ **Decidido 2026-10-10:** sem trial.
- Nota fiscal/Stripe Tax: o produto brasileiro pode exigir emissão de NF-e por fora do Stripe
  (Stripe Tax não emite NF-e brasileira). Isso é trabalho de integração adicional não coberto aqui
  se vier a ser exigido — hoje sinalizado, não dimensionado.
- Quem detém a chave de API em produção e como é rotacionada (gestão de secrets do ambiente de
  produção ainda não existe no projeto — hoje só variáveis de `.env`/Compose de dev).

## 3. Impacto por camada — visão geral

| Camada | Impacto | Tamanho |
|---|---|---|
| `backend/` (Node) | Módulo novo `billing` inteiro (Customer/Subscription/webhook/gating) + rotas novas nos módulos existentes que ganham feature PRO (`ranking`, `lessons`, `profile`) | Grande |
| `engine/` (Go) | Nenhuma mudança pra assinatura em si (billing não é conceito de mercado simulado). Mudança grande e isolada só para **múltiplas carteiras** (seção 9.4) e mudança média pra **cenários sob demanda** (9.5) e **Assembleia dos Investidores** (9.8) | Médio-Grande, concentrado em 2-3 features |
| `frontend/` | Página de planos, retorno de Checkout, botão de Portal, badges/upsell em telas existentes, telas novas de liga privada/cosméticos/assembleias | Grande, mas incremental por feature |
| Banco (gamification) | Tabelas novas: `subscriptions`, `stripe_webhook_events`, + colunas/tabelas por feature (seções 9.x) | Médio |
| Infra/Compose | Variáveis de ambiente novas, uma rota de webhook com corpo raw (não passa pelo `express.json()` global), Stripe CLI pro dev local | Pequeno mas com um detalhe técnico não-óbvio (seção 7.3) |
| `.docs/` | `.docs/backend/billing.md` novo + atualização de qualquer módulo existente que ganhe rota gated | Acompanha cada tarefa, por regra do `CLAUDE.md` |

## 4. Módulo novo `backend/src/modules/billing`

Segue a mesma disciplina DDD lite dos módulos existentes (`auth` como referência viva, por
`CLAUDE.md`) — nenhuma peça nova aqui, é o padrão já usado por `achievements`/`ranking`/etc.
aplicado a um domínio novo.

### `domain/`

- `subscription.ts` — entidade `Subscription` (userId, stripeCustomerId, stripeSubscriptionId,
  status, currentPeriodEnd). Função pura `isActive(subscription): boolean` — único lugar que decide
  o que conta como "PRO ativo" (ex.: `active` e `trialing` contam, `past_due` decide se dá carência
  ou não — decisão de produto pendente da seção 2, mas o *lugar* certo pra essa regra é aqui, uma
  função pura testável, nunca espalhada em cada rota consumidora).
- Sem regra de preço/cálculo aqui — isso é 100% responsabilidade do Stripe (Price object), o domínio
  local só espelha status.

### `application/ports/`

- `paymentGateway.ts` — porta pequena (regra do `arquitetura-backend-ddd-lite.md`): algo como
  `createCheckoutSession(userId, returnUrls)`, `createBillingPortalSession(customerId)`,
  `verifyWebhookSignature(rawBody, signatureHeader)`. **Nenhum código em `domain/`/`application/`
  importa o SDK `stripe` diretamente** — só a implementação em `infrastructure/` importa,
  mecanicamente forçado pelo `no-restricted-imports` do ESLint já existente.
- `subscriptionRepository.ts` — persistência da projeção local (get por userId, upsert por evento
  de webhook).
- `webhookEventLog.ts` — porta pra registrar evento de webhook já processado (chave: id do evento
  Stripe) — suporte à idempotência da seção 6, não é a mesma coisa que `subscriptionRepository`.

### `application/useCases/`

- `startCheckoutUseCase.ts` — recebe userId autenticado, garante/cria `stripe_customer_id` (se o
  usuário ainda não tem um Customer Stripe, cria; se já tem, reusa — nunca duplicar Customer por
  usuário), devolve a URL da Checkout Session pro frontend redirecionar.
- `openBillingPortalUseCase.ts` — idem, pra Billing Portal.
- `handleWebhookEventUseCase.ts` — o coração do módulo (detalhado na seção 6): valida assinatura,
  checa idempotência, dá upsert na `Subscription` local a partir do payload do evento.
- `getSubscriptionStatusUseCase.ts` — consumido por qualquer outro módulo que precise saber "este
  usuário é PRO?" (ver seção 5 — nunca cada módulo consultando a tabela `subscriptions` direto).

### `infrastructure/`

- `stripePaymentGateway.ts` — implementação real com o SDK `stripe` (adicionar `stripe` a
  `backend/package.json`, é o único pacote novo de produção necessário).
- `subscriptionRepository.ts` (Drizzle, tabela `subscriptions` — seção 8).
- `webhookEventLog.ts` (Drizzle, tabela `stripe_webhook_events` — seção 8).

### `interfaces/http/`

- `checkoutRouter.ts` — `POST /billing/checkout-session` (autenticado), `POST /billing/portal-session`
  (autenticado).
- `webhookRouter.ts` — `POST /billing/webhook` (público, autenticado só pela assinatura Stripe —
  ver seção 7.3, corpo raw).
- `schemas.ts` — validação Zod do corpo de `checkout-session`/`portal-session` (o webhook não tem
  schema Zod de payload — a validação dele é a verificação de assinatura, não forma de JSON).

### `test/fakes/`

- `fakePaymentGateway.ts`, `fakeSubscriptionRepository.ts`, `fakeWebhookEventLog.ts` — mesmo padrão
  dos outros módulos, usados pelos testes de caso de uso sem hit real ao Stripe.

Composição (`app.ts`): só ali instancia `stripePaymentGateway` de verdade, lendo `STRIPE_SECRET_KEY`
do ambiente — nenhum outro lugar do código sabe que existe uma chave de API.

## 5. Padrão de feature-gating (novo conceito, distinto de `role`)

O middleware existente (`backend/src/shared/http/authMiddleware.ts`) resolve `role` a partir de
claims dentro do JWT, decodificadas sem tocar o banco — funciona porque `role` muda raríssimo e o
token expira/renova antes de importar. **Plano PRO não pode seguir esse mesmo padrão**: um
cancelamento no meio da vida do token, ou um pagamento recusado sinalizado por webhook, precisa
refletir *antes* do token expirar — do contrário um usuário cancelado continua usando features PRO
pelo tempo de vida do token, o que é uma falha de billing real (não é role trocando raramente, é
status de pagamento que pode virar a qualquer momento por webhook assíncrono).

Decisão técnica proposta: **gating de plano é sempre uma consulta ao caso de uso
`getSubscriptionStatusUseCase`, no caminho da requisição, nunca um claim de JWT.** Concretamente:

- Um `requirePro` não vira `shared/http/authMiddleware.ts` (que é agnóstico de módulo e só lê o
  token) — vira um pequeno *port-consuming* helper dentro de cada caso de uso que precisa gatear
  (ex.: `createPrivateLeagueUseCase` chama `getSubscriptionStatusUseCase.execute(userId)` antes de
  criar a liga). Isso é consistente com a regra do `CLAUDE.md`: regra de negócio (inclusive "isso
  exige plano ativo") vive em `application/useCases/`, nunca em middleware/router genérico.
- Custo: uma consulta a mais (idealmente cacheada — `ranking/infrastructure/cache` já mostra o
  padrão de cache Redis usado no projeto; `subscriptions` é pequena e muda pouco, um TTL curto de
  poucos segundos no Redis evita bater no Postgres em toda requisição sem reintroduzir o problema do
  JWT obsoleto).
- Toda rota HTTP nova que expõe uma capacidade PRO documenta em `.docs/backend/<módulo>.md` que erro
  ela devolve pra usuário sem plano ativo (convenção: `403` com corpo `{ error: 'requer plano PRO' }`,
  nunca `404` — a feature existe, só está bloqueada, e a regra da seção 2/6 da estratégia é nunca
  esconder o que já foi conquistado, então a resposta de erro também não devia "fingir que não
  existe").

## 6. Webhook — idempotência, eventos e reconciliação

### Eventos mínimos a tratar

| Evento Stripe | Efeito local |
|---|---|
| `checkout.session.completed` | Cria/atualiza `subscriptions` com `stripeSubscriptionId`, dispara a mesma lógica de `customer.subscription.created` (o Checkout já cria a Subscription, este evento é o sinal de "sessão fechada com sucesso") |
| `customer.subscription.updated` | Atualiza `status`/`currentPeriodEnd` — cobre upgrade, renovação, `past_due` |
| `customer.subscription.deleted` | Marca local como cancelada — **não deleta a linha nem os dados dependentes** (liga, carteiras extras, cosméticos ficam arquivados, regra da seção 3 da estratégia, seção 9.10 abaixo) |
| `invoice.payment_failed` | Sinaliza `past_due` — decisão de produto pendente (seção 2) sobre dar carência antes de suspender capacidades |

### Idempotência

Cada evento Stripe tem um `id` único (`evt_...`). `webhookEventLog` grava esse id numa tabela com
unique constraint **antes** de aplicar o efeito, na mesma transação — se o Stripe reenviar o mesmo
evento (retry de rede, o handler travou no meio, etc.), o segundo processamento detecta o id já
gravado e responde `200` sem reaplicar. Mesmo espírito do Event Sourcing do motor (`CLAUDE.md`:
nunca aplicar efeito sem registrar o evento primeiro), aplicado aqui a estado de billing em vez de
saldo financeiro simulado — billing agora é a única parte do backend Node lidando com dinheiro real,
então merece o mesmo rigor que o motor já aplica ao dinheiro fictício.

### Reconciliação (rede de segurança)

Webhook pode falhar em chegar (endpoint fora do ar num deploy, por exemplo) além do reenvio
automático do Stripe. Tarefa recomendada: um job periódico (mesmo padrão de ator agendado que o
Temporizador do motor já estabelece (cron job diário + gatilho manual do admin) — aqui do lado Node,
não Go) que lista Subscriptions do Stripe e reconcilia contra a tabela local, pego por divergência
(assinatura ativa no Stripe e `canceled` local, ou vice-versa). Não é dia-1, mas é o tipo de tarefa
que webhook sozinho nunca cobre 100% — deveria entrar no backlog quando o billing for pra produção,
não só em dev/homologação.

## 7. Infra/DevOps

### 7.1 Variáveis de ambiente novas

`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID` (o Price da assinatura PRO) — mesmo
padrão de `docker-compose.yml` hoje (`GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` já seguem esse
formato pro serviço `backend`). Nunca hardcoded, nunca commitado.

### 7.2 Ambiente de teste

Stripe CLI (`stripe listen --forward-to localhost:8000/billing/webhook`) pra receber webhooks em
dev local sem endpoint público — precisa do gateway (`gateway/nginx.conf`) rodando, já que a porta
exposta ao host é a 8000 dele, não a 3000 do backend direto. Cartões de teste do Stripe (skill
`stripe:test-cards` já disponível nesta sessão) cobrem os cenários de sucesso/recusa/3DS sem
nenhuma conta real.

### 7.3 Detalhe técnico não-óbvio: corpo raw no webhook

A verificação de assinatura do Stripe (`stripe.webhooks.constructEvent`) precisa do **corpo bruto
da requisição em bytes**, não do JSON já parseado. O backend hoje usa `express.json()` globalmente
(padrão Express 5) — se esse parser rodar antes da rota de webhook, o corpo já foi consumido/
transformado e a verificação de assinatura falha sempre. A rota `POST /billing/webhook` precisa
estar registrada com `express.raw({ type: 'application/json' })` **especificamente nela**, montada
antes do parser JSON global se ele for `app.use()` de nível de aplicação — checar `app.ts` na hora
de implementar pra garantir que a ordem de middleware não quebra isso. Sinalizado aqui porque é o
tipo de bug que só aparece em runtime contra o Stripe real/CLI, não em teste unitário com fake.

### 7.4 `gateway/nginx.conf`

Nenhuma mudança de rota necessária (`location /` já repassa tudo pro backend) — mas vale nota:
`proxy_pass` do Nginx não deve alterar/bufferizar o corpo da requisição de um jeito que quebre a
verificação de assinatura (não é o comportamento padrão, só registrar como algo a validar
manualmente contra o Stripe CLI antes de marcar a tarefa como concluída, seguindo o checklist do
`CLAUDE.md` de validação ponta a ponta via `docker compose up`).

## 8. Modelo de dados novo (banco `gamification`)

Adições a `backend/src/db/schema.ts`, seguindo a convenção já usada no arquivo (uuid PK,
`references()` pra FK, `unique()` explícito):

```
subscriptions
  userId            uuid PK, references users.id
  stripeCustomerId       varchar, unique
  stripeSubscriptionId   varchar, nullable, unique   -- nulo antes do primeiro checkout
  status                 varchar (ou pgEnum espelhando os status do Stripe usados)
  currentPeriodEnd       timestamp, nullable
  updatedAt              timestamp

stripe_webhook_events
  id            varchar PK   -- o próprio id do evento Stripe (evt_...), não gerado por nós
  processedAt   timestamp
```

Tabelas específicas por feature PRO ficam detalhadas em cada subseção da seção 9 (ex.: `leagues`,
`cosmetic_items`), não aqui — `subscriptions`/`stripe_webhook_events` são a fundação comum a todas.

## 9. Quebra por feature PRO

Ordem desta seção é só de exposição (mesma ordem do documento de estratégia); a ordem de
implementação recomendada está na seção 10.

### 9.1 Fundação de billing (pré-requisito de tudo abaixo)

Tudo das seções 4-8: módulo `billing`, gating, webhook, tabelas `subscriptions`/
`stripe_webhook_events`, página de planos + retorno de Checkout no frontend, botão de Billing
Portal. **Entrega isolada sem nenhuma feature PRO ligada ainda** — o critério de aceite é "dá pra
assinar, cancelar, e o backend sabe corretamente quem é PRO", testável ponta a ponta com Stripe CLI
antes de gatear a primeira feature de verdade. Sem isso, nenhum item abaixo tem onde se apoiar.

### 9.2 Ligas privadas com amigos

Módulo mais próximo de `ranking`/`friendships` já existentes — reaproveita
`ranking/domain/window.ts` (janela de tempo) e o grafo de amizade de `friendships` como fonte de
quem pode ser convidado, mas precisa de tabela própria (uma liga não é o ranking oficial, que
`CLAUDE.md` fixa como Global/Amigos com regra fixa — não mexer nisso).

- Domínio novo (`domain/league.ts`, dentro de `ranking` ou módulo novo `leagues` — decisão de
  escopo pra hora de implementar, mas dado que liga é uma composição de ranking + membership,
  provavelmente módulo novo `leagues` consumindo `ranking` via porta, não o inverso).
- Tabelas: `leagues` (nome, regra de pontuação, janela, criador, `activeSince`/`archivedAt` pra
  suportar a regra de cancelamento da seção 9.10), `league_members`.
- Gating: criar liga nova exige PRO (`requirePro` no caso de uso de criação); **participar** de uma
  liga da qual já é membro não deveria depender do próprio plano do membro (só o criador precisa ser
  PRO — checar essa regra contra a estratégia antes de implementar, o documento fonte não deixa
  100% explícito se membros não-PRO podem participar de liga de amigo PRO; a leitura mais coerente
  com "nunca bloqueia o core loop" da seção 6 da estratégia é que sim, podem).
- Frontend: tela nova de criação/gerenciamento de liga + variante do ranking existente filtrada por
  liga.

### 9.3 Pacote de trilhas/lições extras

O menor risco técnico da lista — reaproveita 100% a infraestrutura de `lessons` já existente
(`backend/src/db/schema.ts` `lessons`/`userLessonProgress`).

- Uma coluna nova em `lessons` (ex.: `tier: 'free' | 'pro'`, default `'free'` — as lições
  centrais nunca mudam de tier, migração só adiciona a coluna, não reclassifica nada existente).
- Gating no caso de uso que serve o conteúdo da lição (`lessons/application/useCases`) — usuário
  free vê a lição no mapa da trilha (nunca esconder que existe, mesma regra da seção 6 da
  estratégia) mas o conteúdo/progresso fica bloqueado até assinar.
- Sem mudança de engine nenhuma.

### 9.4 Múltiplas carteiras simultâneas — a mudança de maior risco de toda a lista

**Isto não é uma feature de feature-flag — é uma mudança de modelo de dados no coração do motor.**
Hoje `engine/internal/domain/account/account.go` modela `Account` com `UserID` como chave primária
implícita (1 conta = 1 usuário, `Repository.Create` não tem noção de "segunda conta pro mesmo
usuário" — `ErrAlreadyExists` existe exatamente pra impedir isso hoje). Positions,
`market_events`/orderexecution/fixedincomeexecution (event sourcing, `CLAUDE.md`) e qualquer cálculo
de patrimônio (`ranking/domain/networth.ts` no backend) presumem essa relação 1:1 hoje.

Suportar 2-3 carteiras por usuário exige introduzir um `AccountID` desacoplado de `UserID` como
chave real, o que se propaga por:

- `engine/internal/domain/account` — `Account` ganha `ID` próprio; `New`/`Open` mudam de assinatura
  (`userID` → `userID, label` ou similar, permitindo N por usuário até um limite).
- Toda tabela do banco `market` com FK implícita em `user_id` (positions, os eventos de
  `market_events`, execuções) precisa migrar pra referenciar `account_id`, com `account_id` novo
  apontando pra `accounts.id`, não mais `user_id` direto. **Migração de dado real**: contas
  existentes viram a "conta principal" de cada usuário, sem perder histórico.
- Toda rota do motor que hoje recebe implicitamente "a conta do usuário autenticado" (via
  `X-User-Id` ou equivalente vindo do backend) passa a exigir também `account_id` explícito —
  contrato HTTP de praticamente todo `.docs/engine/*.md` existente muda.
- `ranking/domain/networth.ts` e qualquer lugar do backend que hoje soma patrimônio por usuário
  precisa decidir: ranking mostra qual carteira? (Decisão de produto não coberta pela estratégia —
  provavelmente "a principal", com as extras fora do ranking oficial, mas **isso precisa virar
  pergunta ao autor antes de implementar**, regra 5 do `CLAUDE.md`.)
- Frontend: seletor de carteira em toda tela hoje implícita numa carteira só (Portfólio, Detalhe de
  Ativo, Confirmação de Ordem — as telas âncora do `identidade-visual-padroes.md`), sem quebrar o
  layout já fixado pra usuário free (que nunca vê o seletor, só tem uma).

Recomendação: **tratar como o item de maior incerteza do backlog inteiro, isolado das outras
tarefas, com uma sessão só de levantamento de impacto no `engine/` antes de qualquer código** —
mesmo tratamento que o backlog principal já dá a tarefas de "tela âncora" (rascunho antes de
implementar), aqui aplicado a arquitetura de dado em vez de layout.

### 9.5 Cenários extras de simulação sob demanda

Achado importante desta análise: o motor **já tem** o mecanismo de disparo de evento macro por
template sob demanda — `engine/internal/domain/macroeventtrigger` + `POST /macro-events` (tarefa
4.4, hoje usado pelo painel admin, `modules/admin/infrastructure/engine`). Só que esse endpoint
dispara um evento que afeta o **Mercado Ao Vivo real, igual pra todos os usuários** — é assim que a
Assembleia dos Investidores (seção 9.8) precisa que funcione, mas é o **oposto** do que "cenário sob
demanda só pra mim" (o assinante testando a própria carteira contra uma crise) deveria fazer.

Ou seja: **este item não pode reusar o disparo de evento macro do Mercado Ao Vivo como está** — um
evento disparado por um assinante não pode mudar o preço de todo mundo. Duas rotas possíveis, a
decidir antes de abrir tarefa (pergunta de produto, não só técnica):

1. Rodar o cenário contra o ambiente de sandbox individual e roteirizado que já existe
   (`engine/internal/domain/sandbox`, hoje usado só pelas lições — ver nota importante abaixo) —
   mas sandbox hoje é roteiro fixo e pré-computado, não reage a um evento macro disparado em tempo
   real; aplicar um "choque" sobre um roteiro fixo é trabalho de domínio novo, não reaproveitamento
   direto.
2. Criar um terceiro ambiente ("carteira de cenário", efêmera, isolada do Mercado Ao Vivo e do
   sandbox de lição) — mais claro conceitualmente, mais caro de construir (não reusa nem o Mercado
   Ao Vivo nem o sandbox como estão).

**Nota pra não confundir em sessão futura**: o pacote `sandbox` do motor (ver comentário de topo de
`engine/internal/domain/sandbox/sandbox.go`) é o ambiente **individual das lições** (RF12/tarefa
4.11), não tem nenhuma relação com "múltiplas carteiras" da seção 9.4 nem foi desenhado pra virar
"modo cenário" — são três conceitos parecidos no nome ("ambiente separado do mercado ao vivo") e
diferentes na função. Este item depende de decisão de produto (opção 1 ou 2 acima) antes de virar
tarefa de engenharia.

### 9.6 Acesso antecipado a conteúdo novo

- Colunas novas em `lessons`/tabela de trilha (ex.: `generalReleaseAt`, `earlyAccessAt`) — entre as
  duas datas, só PRO vê; depois de `generalReleaseAt`, todo mundo.
- Reusa o mesmo gating de 9.3, só com uma janela de tempo em vez de um booleano permanente — dá pra
  implementar como extensão da mesma tarefa, não como módulo à parte.

### 9.7 Cosméticos exclusivos

- Tabela nova `cosmetic_items` (tipo: tema/moldura/emblema visual, nunca emblema de conquista real —
  regra explícita da estratégia, não reusar o catálogo de `achievements`) + `user_cosmetics`
  (userId, itemId, equippedAt/unequippedAt pra suportar arquivamento no cancelamento).
- Provável extensão do módulo `profile` (já dono do avatar/perfil público) em vez de módulo novo —
  decidir na hora olhando o tamanho real do catálogo inicial.
- Frontend: seletor de cosmético em Perfil/Configurações (tela já existente, `6.10`/`6.11` no
  histórico do backlog).

### 9.8 Assembleia dos Investidores (voto flat, efeito macro global)

O maior item novo de domínio da lista, junto com 9.9. Não é gating de feature existente — é
subsistema novo:

- **Motor de votação** (novo módulo, backend ou engine — a decisão de qual lado é melhor discutida
  logo abaixo): abrir período de votação, registrar um voto por conta paga (nunca por conta free,
  nunca peso extra — regra explícita da seção 4 da estratégia), apurar quando o período fecha.
- **Requisito de tempo real público**: "apuração em tempo real visível a todo mundo, pago ou não" —
  não existe hoje nenhum mecanismo de push/tempo real no projeto (o app é request/response +
  polling do TanStack Query). Isso é a peça de infraestrutura genuinamente nova: ou (a) polling
  curto no frontend numa rota que devolve a contagem corrente (mais simples, coerente com o resto do
  stack, latência de alguns segundos aceitável pro caso de uso), ou (b) WebSocket/SSE (mais
  "tempo real" de verdade, mais infraestrutura nova pro projeto). **Recomendação: polling curto
  primeiro** — resolve o requisito funcional (nada é escondido, atualiza em segundos) sem introduzir
  uma tecnologia de tempo real nova só pra esta feature.
- **Ponto de integração real no motor**: `selic.NextCalendarRate`
  (`engine/internal/domain/selic/copom.go`) hoje decide o ajuste da Selic em dia de reunião do Copom
  **por ruído aleatório puro** (`rng.NormFloat64() * cfg.Volatility`). Pra um voto decidir a Selic
  de verdade, esse cálculo precisa aceitar um resultado de votação como entrada no dia de reunião,
  no lugar do (ou combinado com o) ruído — mudança pequena em volume de código, mas central: é uma
  função pura do motor hoje 100% determinística por seed (RNF08) que passa a depender de uma decisão
  externa em tempo real. Testar isso sem quebrar a decoupling deliberada entre `equity` e `selic`
  (`equity.Series` recebe taxa Selic como parâmetro puro, sem importar o pacote `selic` — decisão de
  arquitetura já registrada) é um cuidado explícito a carregar pra essa tarefa.
- Taxação setorial (o outro exemplo da estratégia) já tem caminho pronto: é literalmente um
  `POST /macro-events` com `Target.Sector` — este caso *já* reusa o mecanismo existente sem o
  problema da seção 9.5, porque aqui o efeito **deveria mesmo** ser global (a própria estratégia
  pede isso, seção 4: "resultado se aplica igualmente a todos").
- Backend: caso de uso de "propor pauta" (catálogo pré-definido de templates, sem curadoria humana
  por proposta — regra explícita), gating de PRO só na criação da pauta/voto, nunca na visibilidade
  da apuração.
- Frontend: tela nova de votação + narrativa ("Assembleia dos Investidores", nunca "vocês são o
  Banco Central" — regra de tom da seção 4).

### 9.9 Assembleia de Acionistas (voto proporcional por empresa)

Irmã de 9.8, granularidade por ativo de Renda Variável em vez de plataforma inteira:

- Voto ponderado por posição real do usuário naquela empresa (não por plano) — o peso vem de
  `position`/`orderexecution` do motor (quantidade de ações), não de uma tabela de billing. **Isto
  significa que o cálculo de peso de voto vive no domínio do motor (Go), não no backend Node** —
  ele é quem sabe a posição real de cada conta.
- PRO ganha poder de agenda (propor pauta dum catálogo fixo), nunca poder de resultado — mesma
  separação de 9.8.
- Resultado altera fundamentos da empresa (política de dividendos, recompra) — toca
  `engine/internal/domain/fundamentals`, ativo por ativo.
- Reaproveita a mesma peça de "apuração pública em tempo real" de 9.8 (polling), não precisa
  reinventar.
- Depende de 9.8 estar construído primeiro (mesmo mecanismo de votação, mesmo requisito de
  transparência) — 9.9 é uma extensão de escopo (por-empresa, peso proporcional), não um sistema
  paralelo do zero.

### 9.10 Cancelamento — arquivar, nunca apagar

Regra transversal a 9.2/9.4/9.7/9.8/9.9: nenhuma dessas tabelas usa `DELETE` num cancelamento.
Padrão a aplicar em todas: uma coluna de estado (`archivedAt`/`activeSince` nullable, ou um enum
`active`/`archived`) setada pelo `handleWebhookEventUseCase` ao processar
`customer.subscription.deleted` — nunca uma cascata de exclusão. Reativar a assinatura reverte o
mesmo campo. Isso é regra de negócio (`application/useCases`), não trigger de banco — mantém a
decisão testável e visível no código, coerente com a arquitetura DDD lite do projeto.

## 10. Ordem de implementação sugerida

1. **9.1 — Fundação de billing.** Sem isso nada mais tem onde se apoiar. Validável isoladamente
   (assinar/cancelar funciona, nenhuma feature real ligada ainda).
2. **9.3 — Pacote de trilhas extras.** Menor risco técnico, reaproveita infraestrutura 100% pronta,
   primeira validação real do gating de plano em produção (seção 5) com blast radius pequeno.
3. **9.6 — Acesso antecipado.** Extensão direta de 9.3, praticamente a mesma tarefa com mais uma
   coluna de data.
4. **9.7 — Cosméticos.** Isolado, sem dependência de dado financeiro, bom pra validar o padrão de
   arquivamento no cancelamento (9.10) antes de aplicá-lo a algo mais crítico.
5. **9.2 — Ligas privadas.** Maior de escopo médio, mas ainda contido a `ranking`/`friendships`
   existentes, sem tocar o motor.
6. **9.4 — Múltiplas carteiras.** Isolar numa sessão de levantamento própria antes de codar (seção
   9.4) — é o item que mais provavelmente muda de escopo depois de olhado de perto.
7. **9.5 — Cenários sob demanda.** Depende de uma decisão de produto (opção 1 vs 2 da seção 9.5)
   que ainda não foi feita — não abrir tarefa de engenharia antes dessa resposta.
8. **9.8 — Assembleia dos Investidores.** Maior item de domínio novo; fazer depois de tudo acima
   já ter validado o padrão de gating/billing em produção real, para não empilhar risco de billing
   com risco de subsistema de votação ao mesmo tempo.
9. **9.9 — Assembleia de Acionistas.** Depende de 9.8.

Cada número acima é candidato a **uma ou mais tarefas de backlog** (o mesmo raciocínio de "escopo de
uma sessão" do `CLAUDE.md` se aplica — 9.4 e 9.8 sozinhas provavelmente viram 4-6 tarefas cada, não
uma).

## 11. O que este documento não resolve

- ~~Preço, nome do plano, escopo~~ resolvidos em 2026-10-10 (seção 0 e `estrategia-monetizacao.md`).
- A decisão de produto pendente da seção 9.4 (qual carteira aparece no ranking) e da seção 9.5
  (onde roda o cenário sob demanda) — ambas precisam de resposta do autor antes de virar tarefa,
  regra 5 do `CLAUDE.md`.
- ~~Nenhuma tarefa aberta~~ A análise virou `backlog-monetizacao.md` em 2026-10-10 (Fases A a G);
  este documento fica como o "porquê" técnico.
