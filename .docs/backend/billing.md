# Módulo `billing` (cobrança PRO)

Backlog: `.claude/backlog-monetizacao.md` (Fase B, MO.2.x). A verdade sobre quem é PRO mora no **RevenueCat** (que unifica web, App Store e Play Store); este módulo guarda só uma projeção local (`subscriptions`) e nunca dado de cartão. `app_user_id` do RevenueCat é o `users.id`.

**Configuração (variáveis de ambiente):**

| Variável | Padrão | Uso |
|---|---|---|
| `BILLING_PROVIDER` | `disabled` | `revenuecat` liga a cobrança. `disabled`: ninguém é PRO e o webhook responde 503. `dev`: só desenvolvimento, liga a compra falsa do app (rotas `/billing/dev/*`, abaixo); a subida é **recusada** se houver `REVENUECAT_SECRET_KEY` ou `EMAIL_PROVIDER=resend` (credenciais de um deploy real; `NODE_ENV` não serve, a imagem Docker sempre roda com `production`) |
| `REVENUECAT_SECRET_KEY` | | Chave secreta da API REST (obrigatória com `revenuecat`) |
| `REVENUECAT_WEBHOOK_AUTH` | | Valor exato do cabeçalho `Authorization` configurado no webhook do painel (obrigatória com `revenuecat`) |
| `REVENUECAT_ENTITLEMENT_ID` | `pro` | Identificador do entitlement no painel |
| `REVENUECAT_API_BASE_URL` | `https://api.revenuecat.com/v1` | |
| `REVENUECAT_TIMEOUT_MS` | `10000` | |
| `BILLING_RECONCILE_INTERVAL_MS` | 6 h | Cadência da reconciliação |
| `BILLING_PRICE_MONTHLY_CENTS`, `BILLING_PRICE_ANNUAL_CENTS` | vazio | Preços em **centavos**, só para o painel de conversão estimar a receita recorrente (MO.7.1). O preço de verdade vive nas lojas e no RevenueCat. Vazios = o painel mostra o resto e a receita estimada fica em branco. Valor que não é inteiro positivo derruba a subida |

### `GET /billing/status`

- **Autenticação:** Bearer token
- **Payload:** nenhum
- **Sucesso:** `200` `{ isPro, state, plan, store, expiresAt, willRenew, managementUrl, billingEnabled }`
  - `state`: `none` (nunca assinou), `active`, `billing_issue` (venceu, segue PRO só pela carência da loja) ou `expired`
  - `plan`: `monthly`, `annual` ou `unknown` (assinatura de teste das lojas e concessão promocional); `null` sem assinatura
  - `store`: `app_store`, `play_store`, `stripe`, `rc_billing`, `promotional` ou `other`; `null` sem assinatura
  - `expiresAt`: ISO 8601 ou `null` (sem vencimento ou sem assinatura)
  - `willRenew`: `false` se cancelou, teve falha de cobrança, foi reembolsada ou é concessão promocional
  - `managementUrl`: destino para gerenciar/cancelar conforme `store`; `null` quando o provedor não informa
  - `billingEnabled`: `false` quando `BILLING_PROVIDER=disabled` (o frontend esconde a compra)
- **Erros:** `401` token ausente ou inválido
- **Regra:** a decisão "é PRO?" é recalculada com a hora de agora a cada leitura (`isActive`, função pura): PRO se não foi reembolsada e ainda não venceu (a carência de pagamento conta). O cache Redis (30 s) guarda os fatos, não o veredito, então um vencimento no meio do TTL não deixa ninguém PRO. Nunca é claim de JWT: um cancelamento processado vale na próxima requisição.

### `POST /billing/webhook`

- **Autenticação:** público; autenticado pelo cabeçalho `Authorization` configurado no webhook do RevenueCat (comparação em tempo constante)
- **Payload:** corpo do webhook do RevenueCat (`event.id`, `event.type`, `event.app_user_id`, `original_app_user_id`, `aliases`, `transferred_from`, `transferred_to`, `event_timestamp_ms`); o resto é ignorado. **Só `event.id` e `event.type` são obrigatórios.** Os demais campos aceitam `null` (o RevenueCat manda `null`, por exemplo `aliases: null` em `INVOICE_ISSUANCE`) e, se vierem com tipo estranho, são descartados sem recusar o aviso
- **Sucesso:** `200` `{ received: true, outcome }` com `outcome` = `synced` | `ignored` | `duplicate`
- **Erros:** `401` cabeçalho ausente ou errado (nada é processado); `400` corpo sem `event.id` ou `event.type` (o log traz só os caminhos dos campos inválidos, nunca os valores); `500` falha ao consultar o provedor ou gravar (o RevenueCat reenvia até 5 vezes); `503` cobrança desligada
- **Regra:** o evento é só um **aviso**. Para os tipos que podem mudar o direito ao PRO (compra, renovação, cancelamento, expiração, problema de cobrança, troca de produto, transferência, reembolso revertido, etc.), o caso de uso reconsulta `GET /v1/subscribers/{app_user_id}` e regrava a projeção, o que é convergente (repetido ou fora de ordem dá o mesmo resultado). Ids que não são UUID (anônimos do RevenueCat) ou que não são usuários nossos são descartados; `TRANSFER` sincroniza origem e destino. O id do evento é gravado em `billing_webhook_events` só **depois** de processar, então uma falha no meio deixa o evento reprocessável. Eventos que não interessam (`TEST`, experimento, moeda virtual) respondem `200` e são registrados.

## Compra falsa para desenvolvimento (`BILLING_PROVIDER=dev`, MO.4.1)

Para testar o app sem contas de loja nem RevenueCat. Fora do modo `dev` estas rotas **não existem** (404) e `loadBillingConfig` derruba a subida se `dev` vier junto de credenciais reais (acima). `GET /billing/status` devolve `billingEnabled: true` neste modo. Não há webhook nem reconciliação (503 / job desligado).

### `POST /billing/dev/purchase`

- **Autenticação:** Bearer token
- **Payload:** `{ plan: 'monthly' | 'annual', store: 'app_store' | 'play_store' }`
- **Sucesso:** `204`. Grava a assinatura da própria pessoa (30 dias no mensal, 365 no anual, renova), com `product_id` `dev.fake.<plan>`, e invalida o cache de status
- **Erros:** `400` corpo fora do contrato; `401` token ausente ou inválido; `404` fora do modo `dev`
- **Regra:** o prefixo `dev.fake.` no `product_id` é o que distingue de uma compra real no banco (as lojas nunca emitem um id assim)

### `DELETE /billing/dev/subscription`

- **Autenticação:** Bearer token
- **Sucesso:** `204`. Encerra a vigência agora (a linha fica, como no fluxo real); sem assinatura não faz nada
- **Erros:** `401`; `404` fora do modo `dev`

## Funil e painel de conversão (MO.1.3 / MO.7.1)

**Retenção (ponto 048, decisão de 2026-10-11):** os eventos ficam 12 meses (`FUNNEL_RETENTION_MONTHS`) e são apagados por `PurgeOldFunnelEventsUseCase`, agendado uma vez por dia no `server.ts` (`startFunnelRetentionScheduler`, roda com qualquer provedor). Excluir a conta (`DELETE /me`) não apaga os eventos: a conta é anonimizada (sem nome, e-mail, username nem senha), então o que resta já não identifica ninguém, e o prazo de 12 meses vale igual. A Política de Privacidade (`/privacidade`) cita a medição e o prazo.

Medição própria no Postgres (`funnel_events`), sem ferramenta de terceiro: nenhum dado de usuário sai da plataforma. Um evento guarda só quem, qual passo, de que ponto de convite e (na compra) qual plano; **nunca valor em reais nem patrimônio** (RNF09). Passos: `invite_viewed`, `plans_opened`, `purchase_started` (reportados pelo app) e `subscribed`, `cancelled` (gravados só pelo servidor, a partir dos mesmos fatos que geram o e-mail de boas-vindas e o de encerramento; assinatura de teste das lojas e concessão promocional não geram evento). Pontos de convite (`source`): `league`, `duel`, `cosmetics`, `retrospective` e `assembly` (os cinco convites de âncora), `portfolio` (cartão "O que o PRO traz" do Portfólio), `menu` (item do menu do avatar), `header` (link ou selo do cabeçalho; migração `0052`, MO.9.8) e `direct` (abriu `/planos` sem passar por nenhum deles). A gravação é idempotente por `dedupe_key`.

### `POST /billing/funnel`

- **Autenticação:** Bearer token
- **Payload:** `{ event: 'invite_viewed' | 'plans_opened' | 'purchase_started', source?: 'league' | 'duel' | 'cosmetics' | 'retrospective' | 'assembly' | 'portfolio' | 'menu' | 'header' | 'direct', plan?: 'monthly' | 'annual' }`
- **Sucesso:** `204`
- **Erros:** `400` corpo fora do contrato (inclusive `subscribed`/`cancelled`, que o cliente não pode reportar); `401` token ausente ou inválido
- **Regra:** no máximo um evento por pessoa, evento, origem e dia (UTC); repetir o mesmo no dia não grava de novo e responde `204` igual. Não depende de a pessoa ser PRO nem de a cobrança estar ligada.

### `GET /admin/billing/conversion?days=30`

- **Autenticação:** Bearer token, `role = admin` (`403` para os demais). Só leitura, fora da auditoria
- **Query:** `days` = `7`, `30` (padrão) ou `90`
- **Sucesso:** `200`
  - `subscribers`: `{ active, monthly, annual, unknown }` (ativos agora; `unknown` = plano que não dá para inferir)
  - `recurringRevenueCents`: receita recorrente mensal estimada em centavos (mensal pelo preço cheio, anual dividido por 12), ou `null` sem os dois preços configurados
  - `churn`: `{ cancelled, startOfWindow, rate }` com `rate = cancelled / startOfWindow` (ou `null` sem base)
  - `funnel`: pessoas distintas na janela em `lessonCompleted` (do progresso das lições), `inviteViewed`, `plansOpened`, `purchaseStarted`, `subscribed`, `cancelled`
  - `bySource`: uma linha por ponto de convite (sempre os cinco, em ordem fixa) com `reached` (pessoas com qualquer evento ali), `inviteViewed`, `plansOpened`, `purchaseStarted`, `subscribed` e `conversionRate` (`subscribed / reached`, ou `null`)
  - `windowDays`, `generatedAt`
- **Erros:** `400` `days` fora de 7/30/90; `401`; `403`
- **Regra:** só conta assinatura de cliente pagante (fora conta de teste das lojas e concessão promocional). Ativa/vencida usa `isActive` com a hora de agora. `churn.startOfWindow` é reconstruído (ativos hoje - quem assinou na janela + quem cancelou na janela), então é uma estimativa. "Assinou" por ponto conta quem teve contato com o ponto e assinou **depois**, na janela; uma pessoa pode contar em mais de um ponto. Lê a tabela `subscriptions` inteira (o volume é o de quem assina ou assinou, não o de usuários).

## Gating de feature PRO (para os outros módulos)

Nenhuma rota própria. Um caso de uso gateado injeta `ProAccessGuard` (exportado por `createBillingModule`) e chama `await guard.assertPro(userId)`; sem plano ativo lança `ProRequiredError` (`code: 'PRO_REQUIRED'`), que o `jsonErrorHandler` converte em **`403 { "error": "requer plano PRO" }`** (nunca 404). Toda rota que gateia deve documentar esse erro no arquivo do próprio módulo.

## E-mails do ciclo de vida (MO.3.4)

Sem rota nova. `SyncSubscriptionUseCase` compara a projeção anterior com a nova (`lifecycleEmails`, função pura) e enfileira no outbox do módulo `notifications`, categoria `transactional` (sem opt-out; o recibo continua sendo da loja/checkout):

| Template | Quando | Chave de idempotência |
|---|---|---|
| `pro_welcome` | primeira assinatura, ou volta depois de mais de 7 dias sem PRO (renovação com webhook atrasado não conta) | `pro-welcome:<userId>:<purchasedAt>` |
| `pro_billing_issue` | falha de cobrança nova (`billingIssueDetectedAt` mudou); leva o link de gerenciar da loja (o do provedor, ou a página oficial de assinaturas da App Store/Play Store) | `pro-billing-issue:<userId>:<detectedAt>` |
| `pro_ended` | assinatura vencida e sem carência, para quem já tinha projeção gravada | `pro-ended:<userId>:<expiresAt>` |

A chave é a do **fato**, então webhook repetido, reconciliação ou reenvio não duplicam. Os avisos entram no outbox **antes** de gravar a projeção: se o enfileiramento falhar, nada é gravado e o reenvio do webhook (500) ainda detecta a transição.

## Jobs

- **Reconciliação** (rede de segurança do webhook): a cada 6 h (só com `BILLING_PROVIDER=revenuecat`) reconsulta quem tem projeção parada há mais de 12 h e vigência ativa ou vencida há menos de 3 dias, em lote de 200, mais velhos primeiro, com 200 ms entre consultas. Uma falha isolada não para o lote.

## Concessão de PRO promocional (MO.2.5 e MO.7.2)

`GrantPromotionalProUseCase`: `currentAccessEnd(userId)` devolve o fim do acesso PRO de agora (ou `null`) e `grantUntil(userId, endsAt)` concede até a data. Adapter do RevenueCat: `POST /v1/subscribers/{app_user_id}/entitlements/{entitlement}/promotional` com `{ end_time_ms }` (documentação conferida em 2026-10-11; `duration` e `start_time_ms` são os campos descontinuados; um fim a menos de 2 h de uma concessão promocional ativa é tratado como duplicata e não estende), resposta `201`, e em seguida reconsulta a assinatura para a projeção local enxergar a concessão (`store: promotional`). Com `BILLING_PROVIDER=dev` grava a projeção direto; com `disabled` falha com `BillingDisabledError`. Consumidores: a recompensa da indicação (`referrals.md`) e o painel admin (`POST /admin/users/:id/pro-grants` e `GET /admin/users/:id/pro`, em `admin.md`: 1 a 90 dias por concessão, motivo obrigatório, senha recente, auditoria `billing.grant_promotional`).

## Pendente

Não validado contra o RevenueCat real (sem chave nesta fase): o adapter da concessão tem teste com `fetch` simulado. Conferir com a chave em mãos antes de usar o painel em produção.
