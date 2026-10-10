# `notifications`: envio de e-mail (outbox, supressão e webhook do provedor)

Módulo: `backend/src/modules/notifications/`. Desenho em `.claude/plano-gateway-email.md` e tarefas em `.claude/backlog-email.md`. Hoje só expõe a rota do webhook do provedor; o envio em si é interno (outros módulos enfileiram, um worker entrega).

---

### `POST /webhooks/resend`

- **Autenticação:** a própria assinatura do provedor (Svix), não JWT. A rota só existe quando o backend sobe com `EMAIL_PROVIDER=resend` **e** `RESEND_WEBHOOK_SECRET` configurado; sem isso responde `404` e o backend avisa no log da subida que bounces e reclamações não serão processados.
- **Payload:** o JSON do evento do Resend, enviado como `application/json`, mais os cabeçalhos `svix-id`, `svix-timestamp` e `svix-signature`. A assinatura cobre os bytes exatos do corpo, por isso a rota usa `express.raw` e é montada antes do `express.json()` global (`app.ts`).
- **Sucesso:** `200` → `{ received: true, handled: "delivered" | "bounced" | "complained" | "ignored" }`. Evento de tipo que não interessa (aberto, clicado, atrasado...) também é `200` com `handled: "ignored"`, senão o provedor reenviaria para sempre.
- **Erros:**
  - `400` — algum cabeçalho `svix-*` ausente, corpo que não é JSON, **ou** assinatura inválida / timestamp com mais de 5 minutos (nada é processado).
  - `500` — erro nosso ao processar (ex.: banco fora); o provedor reenvia e o processamento é idempotente.
- **Regra:** `ReceiveProviderWebhookUseCase`. `email.delivered` grava `email_outbox.delivered_at` na linha cujo `provider_message_id` bate. `email.bounced` com tipo **Permanent** grava o endereço em `email_suppressions` como `bounce` (bounce transitório ou indeterminado não suprime: o provedor mesmo tenta de novo). `email.complained` grava `complaint`. Repetir o mesmo evento deixa o mesmo estado, e uma supressão só sobe de gravidade (`bounce` > `complaint` > `unsubscribe_all`), nunca desce.

## Lista de supressão (efeito do webhook em quem enfileira)

Consultada em todo enfileiramento (`EnqueueEmailUseCase`) e de novo na entrega (`DeliverPendingEmailsUseCase`), porque um bounce pode chegar entre uma coisa e outra. A linha suprimida fica no outbox com `status = 'suppressed'` e `last_error = 'suppressed:<motivo>'` para explicar por que o e-mail não saiu.

| Motivo | Barra |
|---|---|
| `bounce` | tudo, inclusive segurança (insistir num endereço inexistente só piora a reputação do domínio) |
| `complaint`, `unsubscribe_all` | só e-mail opcional (social, engajamento); recuperação de senha e verificação continuam saindo |
