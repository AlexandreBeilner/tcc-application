# `notifications`: envio de e-mail (outbox, supressão e webhook do provedor)

Módulo: `backend/src/modules/notifications/`. Desenho em `.claude/plano-gateway-email.md` e tarefas em `.claude/backlog-email.md`. Expõe a rota do webhook do provedor e as de preferências/cancelamento de inscrição; o envio em si é interno (outros módulos enfileiram, um worker entrega).

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

---

## Preferências e cancelamento de inscrição (EM.6.1)

Duas categorias de e-mail são **opcionais**: `social` (ex.: pedido de amizade) e `engagement` (resumo semanal, salário, conquista rara, lembrete de sequência). Ambas nascem **desligadas** (D8: nenhum e-mail opcional sem pedido explícito). `security` e `transactional` (reset, verificação, suspensão, exclusão, comunicado crítico) **não são desligáveis** e não aparecem no contrato.

**Regra do enfileiramento (`EnqueueEmailUseCase`), só para categoria opcional:** exige `userId` conhecido, conta **ativa** (suspensa não recebe nada opcional), com e-mail **verificado** e não anonimizada, e a categoria **ligada** pelo usuário; senão devolve `rejected` (`recipient_unknown`, `recipient_not_eligible` ou `not_opted_in`) e **nada é gravado**. Passando, injeta `unsubscribeUrl` no payload, e o renderer manda o `List-Unsubscribe` + `List-Unsubscribe-Post` e o link no rodapé. A entrega confere a preferência de novo: quem cancelou depois que o e-mail entrou na fila (lote agendado) não recebe (`status = 'suppressed'`, `last_error = 'suppressed:unsubscribed'`). O link de cancelar é apagado do payload quando a linha fecha.

### `GET /me/email-preferences`

- **Autenticação:** Bearer token.
- **Payload:** nenhum.
- **Sucesso:** `200` → `{ preferences: { social: boolean, engagement: boolean }, suppression: "bounce" | "complaint" | "unsubscribe_all" | null }`. `suppression` diz por que o **endereço da conta** não recebe e-mail (bounce: o endereço não entrega; reclamação: foi marcado como spam); a tela de Configurações mostra o aviso.
- **Erros:** `401` — token ausente ou inválido.
- **Regra:** `GetEmailPreferencesUseCase`. Sem linha gravada, tudo `false`.

### `PATCH /me/email-preferences`

- **Autenticação:** Bearer token.
- **Payload:** `{ social?: boolean, engagement?: boolean }`, ao menos um campo, nenhum campo desconhecido (`security: false` é `400`, não é ignorado).
- **Sucesso:** `200` → `{ preferences: { social, engagement } }` (estado final).
- **Erros:** `400` — payload inválido; `401` — token ausente ou inválido.
- **Regra:** `UpdateEmailPreferencesUseCase`. Upsert parcial: só as categorias informadas mudam. Usada pela tela de Configurações e pela pergunta do onboarding (tela 1.2).

### `GET /email/unsubscribe?token=...`

- **Autenticação:** público (o token assinado é a autorização).
- **Sucesso:** `302` para `${FRONTEND_URL}/cancelar-inscricao#token=<token>` (página de confirmação do frontend). **Nunca cancela nada**: scanners de e-mail "clicam" em todo link, e um `GET` que cancelasse descadastraria todo mundo sozinho.
- **Erros:** `400` — sem `token`.

### `POST /email/unsubscribe`

- **Autenticação:** público; o token HMAC no link é a autorização (sem login, descadastro de um clique).
- **Payload:** `token` na query (é a URL do `List-Unsubscribe`, que Gmail/Yahoo chamam por POST com `List-Unsubscribe=One-Click` no corpo) **ou** `{ token }` no JSON (página de confirmação do frontend). Máx. 400 caracteres.
- **Sucesso:** `200` → `{ status: "cancelado", category: "social" | "engagement" }`.
- **Erros:** `400` — token ausente, adulterado, truncado ou de categoria inválida (não é `401` de propósito: não há sessão, e `401` dispararia o tratamento de sessão expirada do frontend). Limite de 30 requisições por minuto por IP.
- **Regra:** `UnsubscribeByTokenUseCase`. O token é `<userId>.<categoria>.<HMAC-SHA256>` (base64url), assinado com `EMAIL_UNSUBSCRIBE_SECRET` (reserva: `JWT_SECRET`), com rótulo de finalidade na mensagem assinada; **não expira**. Desliga só a categoria do e-mail em questão, é idempotente e reversível em Configurações (ligar de novo é um consentimento novo). O cancelamento mexe nas **preferências** (não na lista de supressão, que é por endereço e não tem como ser desfeita pelo usuário).

### Configuração

| Variável | Para quê |
|---|---|
| `PUBLIC_API_URL` | URL pública do gateway, base do link de cancelar (o `List-Unsubscribe-Post` precisa de uma URL que aceite POST). Padrão `http://localhost:8000`. |
| `EMAIL_UNSUBSCRIBE_SECRET` | Segredo do HMAC do token. Vazio usa o `JWT_SECRET`. |
| `FRONTEND_URL` | Destino do redirecionamento do `GET`. |

### Exportação e exclusão de conta (LGPD)

`GET /me/export` ganhou `emailPreferences` (`.docs/backend/auth.md`). `DELETE /me` (e a exclusão pelo admin) apaga a linha de `email_preferences` e as linhas do `email_outbox` do usuário (endereço e payload são dado pessoal), **menos** a confirmação `account_deleted`, que ainda precisa sair; a limpeza dessa última é feita pela retenção abaixo (30 dias depois de enviada). A supressão por endereço fica: é do endereço, não da pessoa.

### Retenção do outbox (EM.8.1)

`PurgeOldEmailsUseCase`: linhas **fechadas** (`sent`, `failed` ou `suppressed`) há mais de **30 dias** perdem `to_address` (vira `''`) e `payload` (vira `{}`), porque endereço e conteúdo são dado pessoal que não precisa ficar depois que o e-mail saiu ou desistiu de sair. A linha mínima (id, `user_id`, template, categoria, status, datas, `last_error`, `provider_message_id`) fica para auditoria. O fechamento conta por `sent_at` (ou `created_at` para o que nunca foi enviado). Linhas `pending`/`sending` nunca são limpas. Idempotente (não reconta linhas já limpas). Roda no mesmo processo do worker (`startEmailOutboxScheduler`), na subida e depois no máximo uma vez por hora, com falha isolada da entrega. Isso também elimina o endereço residual do `account_deleted`.

A saúde da fila (pendentes, falhas, pendente mais antigo) aparece em `GET /admin/system/health` (`.docs/backend/admin.md`).
