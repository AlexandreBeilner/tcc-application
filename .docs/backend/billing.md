# Módulo `billing` (cobrança PRO)

Backlog: `.claude/backlog-monetizacao.md` (Fase B, MO.2.x). A verdade sobre quem é PRO mora no **RevenueCat** (que unifica web, App Store e Play Store); este módulo guarda só uma projeção local (`subscriptions`) e nunca dado de cartão. `app_user_id` do RevenueCat é o `users.id`.

**Configuração (variáveis de ambiente):**

| Variável | Padrão | Uso |
|---|---|---|
| `BILLING_PROVIDER` | `disabled` | `revenuecat` liga a cobrança. `disabled`: ninguém é PRO e o webhook responde 503 |
| `REVENUECAT_SECRET_KEY` | | Chave secreta da API REST (obrigatória com `revenuecat`) |
| `REVENUECAT_WEBHOOK_AUTH` | | Valor exato do cabeçalho `Authorization` configurado no webhook do painel (obrigatória com `revenuecat`) |
| `REVENUECAT_ENTITLEMENT_ID` | `pro` | Identificador do entitlement no painel |
| `REVENUECAT_API_BASE_URL` | `https://api.revenuecat.com/v1` | |
| `REVENUECAT_TIMEOUT_MS` | `10000` | |
| `BILLING_RECONCILE_INTERVAL_MS` | 6 h | Cadência da reconciliação |

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
- **Payload:** corpo do webhook do RevenueCat (`event.id`, `event.type`, `event.app_user_id`, `original_app_user_id`, `aliases`, `transferred_from`, `transferred_to`, `event_timestamp_ms`); o resto é ignorado
- **Sucesso:** `200` `{ received: true, outcome }` com `outcome` = `synced` | `ignored` | `duplicate`
- **Erros:** `401` cabeçalho ausente ou errado (nada é processado); `400` corpo fora do formato; `500` falha ao consultar o provedor ou gravar (o RevenueCat reenvia até 5 vezes); `503` cobrança desligada
- **Regra:** o evento é só um **aviso**. Para os tipos que podem mudar o direito ao PRO (compra, renovação, cancelamento, expiração, problema de cobrança, troca de produto, transferência, reembolso revertido, etc.), o caso de uso reconsulta `GET /v1/subscribers/{app_user_id}` e regrava a projeção, o que é convergente (repetido ou fora de ordem dá o mesmo resultado). Ids que não são UUID (anônimos do RevenueCat) ou que não são usuários nossos são descartados; `TRANSFER` sincroniza origem e destino. O id do evento é gravado em `billing_webhook_events` só **depois** de processar, então uma falha no meio deixa o evento reprocessável. Eventos que não interessam (`TEST`, experimento, moeda virtual) respondem `200` e são registrados.

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

## Pendente (MO.2.5)

Concessão promocional pelo painel admin: não implementada porque a referência do endpoint de concessão do RevenueCat não estava acessível na hora da implementação. Conferir a documentação atual antes de escrever o adapter.
