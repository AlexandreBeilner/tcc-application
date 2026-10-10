# `notifications`: envio de e-mail (outbox, supressão e webhook do provedor)

Módulo: `backend/src/modules/notifications/`. Desenho em `.claude/plano-gateway-email.md` e tarefas em `.claude/backlog-email.md`. Expõe a rota do webhook do provedor e as de preferências/cancelamento de inscrição; o envio em si é interno (outros módulos enfileiram, um worker entrega).

---

## Visão geral do módulo

Nenhum caso de uso de negócio fala com o provedor: quem precisa mandar e-mail declara uma port própria (ex.: `FriendRequestMailer`, `AccountMailer`) e um adapter fino chama `EnqueueEmailUseCase`, que grava uma linha em `email_outbox` (na mesma transação da escrita de negócio quando é preciso). Um worker entrega.

**Ciclo de uma linha do outbox.** `pending` → (worker reivindica com `FOR UPDATE SKIP LOCKED`) `sending` → `sent` (o `delivered_at` chega depois pelo webhook), ou volta a `pending` com backoff, ou `failed`, ou `suppressed`.

| Peça | Regra |
|---|---|
| Idempotência | `idempotency_key` única (ex.: `password-reset:<tokenId>`); repetir o enfileiramento devolve a linha existente. A `id` da linha é o `Idempotency-Key` do Resend, então reenvio depois de queda não duplica. |
| Worker | `DeliverPendingEmailsUseCase`, a cada `EMAIL_OUTBOX_INTERVAL_MS` (padrão 5 s), lote de 20, espaçando os envios por `EMAIL_SEND_RPS` (padrão 2 por segundo). Linha `sending` presa há mais de 10 min volta a `pending` (processo caiu). |
| Reenvio | Erro permanente do provedor (4xx, endereço inválido) vai direto a `failed`. Erro transitório (429, 5xx, timeout) reagenda com backoff de 1 min, 5 min, 30 min e 2 h, até 5 tentativas; depois `failed`. |
| Categorias | `security` e `transactional` não têm opt-out; `social` e `engagement` são opcionais e nascem desligadas (seção de preferências abaixo). |
| Segredos | O link com token de um e-mail de segurança fica no `payload` só até a linha fechar (`sensitiveFields` do template): depois de `sent` ou `failed`, o token em claro some do banco. |
| Log | Os adapters não registram destinatário completo nem token. |

**Templates** (funções TS puras em `domain/templates/registry.ts`, um `htmlEmailRenderer` monta HTML e texto): `password_reset`, `email_verification`, `password_changed`, `sessions_ended` (segurança); `welcome`, `data_exported`, `account_adjusted`, `announcement`, `system_test` (transacional); `account_suspended`, `account_reactivated`, `account_deleted` (segurança); `friend_request_received`, `friend_request_accepted` (social); `weekly_digest`, `salary_credited`, `rare_achievement`, `streak_reminder` (engajamento). Nenhum e-mail carrega patrimônio absoluto de outro usuário (RNF09) nem usa travessão como pontuação.

**Configuração.**

| Variável | Para quê |
|---|---|
| `EMAIL_PROVIDER` | Obrigatória: `resend` envia de verdade; `log` imprime assunto e links no console (só desenvolvimento, **marca a linha como `sent` sem entregar nada**). O Compose fixa `log` por padrão. |
| `RESEND_API_KEY` | Chave com permissão só de envio, uma por ambiente. Obrigatória com `resend`. |
| `RESEND_WEBHOOK_SECRET` | `whsec_...` do endpoint de webhook; sem ele a rota não existe e o backend avisa no log. |
| `EMAIL_FROM`, `EMAIL_REPLY_TO` | Remetente (obrigatório com `resend`) e resposta humana opcional. |
| `EMAIL_SEND_RPS`, `EMAIL_OUTBOX_INTERVAL_MS` | Cadência do worker (padrões acima). |
| `EMAIL_STREAK_REMINDER` | `on` liga o lembrete de sequência em risco (EM.7.3). Desligado por padrão até medir cancelamento e reclamação do resumo semanal. |
| `EMAIL_ENGAGEMENT_INTERVAL_MS` | De quanto em quanto tempo os jobs de engajamento checam se estão na janela (padrão 15 min). |

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

## E-mails de engajamento (EM.7.x)

Categoria `engagement`: sempre opt-in (D8), com `List-Unsubscribe` e o link de cancelar no rodapé. Os jobs não são rotas: `startEngagementScheduler` (processo do backend) chama os casos de uso a cada `EMAIL_ENGAGEMENT_INTERVAL_MS`; cada caso de uso decide se está na janela, e a **chave de idempotência** do e-mail garante que repetir a checagem, reiniciar o processo ou ter mais de uma réplica nunca duplica. Falha de um usuário ou de um job não derruba os outros. O horário é o de Brasília (UTC-3). A audiência é pré-filtrada em SQL (conta ativa, e-mail verificado, não anonimizada, `engagement` ligado, em páginas de 200 por cursor de `id`) e `EnqueueEmailUseCase` confere tudo de novo ao enfileirar, então quem desligou entre a leitura e o envio não recebe.

### Resumo semanal (EM.7.1, E12)

`SendWeeklyDigestUseCase`, template `weekly_digest`. **Janela:** segunda-feira, das 9h às 20h59 de Brasília (quem liga a opção na segunda à tarde ainda recebe o da semana). **Chave:** `weekly-digest:<userId>:<segunda de Brasília>`, um por pessoa por semana. **Conteúdo (RNF09):** nível, rentabilidade percentual da semana (do último `ranking_snapshots`, critério geral, janela semanal, sem chamar o motor) e uma missão do dia ainda pendente (a de maior XP, mais a contagem das outras). Sem valor absoluto de patrimônio. **Tom:** rentabilidade negativa nunca aparece como número nem como perda, a mensagem fala do mercado e convida a rever a carteira com calma; quem não está no ranking recebe sem o percentual.

### Salário creditado e conquista rara (EM.7.2, E11 e E14)

Os dois são disparados pelo módulo dono do fato, por uma port própria (`SalaryMailer` em `payroll`, `AchievementMailer` em `achievements`) com adapter sobre `EnqueueEmailUseCase`; só enfileiram para quem ligou `engagement`, e uma falha ao enfileirar só é logada (nunca desfaz o pagamento nem o desbloqueio).

- **`salary_credited`:** `CreditMonthlyPayrollForUserUseCase` avisa uma vez por rodada, depois de creditar e gravar o mês. Chave `salary:<userId>:<último mês creditado>`, então repetir a rodada não duplica; um catch-up de vários meses (backend fora do ar) vira **um** e-mail com os meses, o valor por mês e o total. O valor é o do próprio destinatário (RNF09 vale entre usuários). O texto lembra que o salário não conta como rentabilidade no ranking.
- **`rare_achievement`:** `CheckAndUnlockAchievementsUseCase` avisa depois de gravar o desbloqueio, só se a conquista for rara (`isRareAchievement`: no máximo 10% dos jogadores ativos a têm, com base de pelo menos 20; regra provisória, ver ponto 044 de `pontos-em-aberto-decisao-produto.md`). Chave `achievement-rare:<userId>:<conquistaId>`. O e-mail leva só o nome e a descrição da conquista, nunca quantas pessoas a têm.

### Lembrete de sequência em risco (EM.7.3, E13, D9)

`SendStreakRemindersUseCase`, template `streak_reminder`. **Desligado por padrão** (`EMAIL_STREAK_REMINDER=on` liga): o plano manda medir cancelamento e reclamação do resumo semanal antes. **Quem recebe:** `engagement` ligado, conta ativa e e-mail verificado (suspensa nunca recebe opcional), sequência atual de **3 dias ou mais** e **última atividade qualificada ontem** (UTC, o dia do streak): quem já fez a atividade de hoje não recebe, e quem não fez ontem já perdeu a sequência e não é cobrado por isso. **Janela:** 17h a 19h59 de Brasília (o dia do streak termina às 21h de Brasília). **Teto de 1 por dia** pela chave `streak-reminder:<userId>:<dia>`. **Tom:** convite, nunca cobrança: "Sua sequência de N dias segue de pé até as 21h de hoje (horário de Brasília). Quer fazer uma lição rápida?", sem escassez, culpa, contagem regressiva ou menção ao que se perde (o teste do template trava essas palavras). Regras provisórias: ponto 045 de `pontos-em-aberto-decisao-produto.md`.

### Exportação e exclusão de conta (LGPD)

`GET /me/export` ganhou `emailPreferences` (`.docs/backend/auth.md`). `DELETE /me` (e a exclusão pelo admin) apaga a linha de `email_preferences` e as linhas do `email_outbox` do usuário (endereço e payload são dado pessoal), **menos** a confirmação `account_deleted`, que ainda precisa sair; a limpeza dessa última é feita pela retenção abaixo (30 dias depois de enviada). A supressão por endereço fica: é do endereço, não da pessoa.

### Retenção do outbox (EM.8.1)

`PurgeOldEmailsUseCase`: linhas **fechadas** (`sent`, `failed` ou `suppressed`) há mais de **30 dias** perdem `to_address` (vira `''`) e `payload` (vira `{}`), porque endereço e conteúdo são dado pessoal que não precisa ficar depois que o e-mail saiu ou desistiu de sair. A linha mínima (id, `user_id`, template, categoria, status, datas, `last_error`, `provider_message_id`) fica para auditoria. O fechamento conta por `sent_at` (ou `created_at` para o que nunca foi enviado). Linhas `pending`/`sending` nunca são limpas. Idempotente (não reconta linhas já limpas). Roda no mesmo processo do worker (`startEmailOutboxScheduler`), na subida e depois no máximo uma vez por hora, com falha isolada da entrega. Isso também elimina o endereço residual do `account_deleted`.

A saúde da fila (pendentes, falhas, pendente mais antigo) aparece em `GET /admin/system/health` (`.docs/backend/admin.md`).

---

## Runbook

Consultas abaixo no banco de usuário/gamificação (`psql`).

### Rotacionar a chave de API do Resend

1. No painel do Resend (API Keys), criar uma chave nova com **Sending access** restrita ao domínio de envio. Não apagar a antiga ainda.
2. Colocar o valor novo em `RESEND_API_KEY` no ambiente e reiniciar o backend (a chave é lida na subida). O worker é do mesmo processo, então a troca vale já no próximo ciclo.
3. Validar: `EMAIL_PROVIDER=resend RESEND_API_KEY=... EMAIL_FROM=... npm run email:test -- seu@email.com` (no `backend/`) e conferir que chegou. Em seguida, `GET /admin/system/health` deve mostrar `email_outbox` em dia.
4. Só então revogar a chave antiga no Resend. Linhas que falharam por chave inválida no meio da troca ficam `failed` com o erro em `last_error` (não são reenviadas sozinhas).
5. O segredo do webhook (`RESEND_WEBHOOK_SECRET`) tem rotação própria: o Resend mostra um novo Signing Secret por endpoint; trocar a variável e reiniciar. Entre a troca no painel e o restart, eventos chegam com `400` e o provedor reenvia (o processamento é idempotente).
6. Se a chave vazou: revogar primeiro, rotacionar depois (o envio para até o passo 2; recuperação de senha fica sem e-mail nesse intervalo, e o worker reenvia o que falhou enquanto ainda houver tentativas).

### O domínio de envio entrou em lista de bloqueio, ou a entrega caiu

Sintomas: pico de `bounced`/`complained` no painel do Resend, a fila no painel admin em "Atenção" (pendentes antigos ou falhas acumulando), usuários dizendo que não recebem o e-mail de verificação ou de recuperação de senha.

1. **Medir.** `select status, count(*) from email_outbox where created_at > now() - interval '24 hours' group by 1;` e `select last_error, count(*) from email_outbox where status = 'failed' and created_at > now() - interval '24 hours' group by 1 order by 2 desc;`. Ver também a aba de entregas do webhook no Resend.
2. **Descartar causa nossa.** `EMAIL_PROVIDER` está `resend` (e não `log`, que marca como enviado sem entregar)? Domínio com status **Verified** e registros SPF, DKIM e DMARC ainda no DNS? Chave válida? `RESEND_WEBHOOK_SECRET` configurado (sem ele, bounces não chegam em `email_suppressions` e continuamos insistindo em endereços mortos)?
3. **Confirmar a lista de bloqueio.** Consultar o domínio e o IP de envio numa ferramenta de blacklist (MXToolbox, Google Postmaster Tools) e abrir o pedido de remoção no provedor da lista. O Resend tem suporte para casos de IP compartilhado.
4. **Conter.** Não há chave de pausa no código. Para não queimar reputação enquanto resolve, o caminho é desligar as categorias opcionais na origem (não ligar novos e-mails de engajamento) e deixar só segurança e transacional, que são o que o usuário precisa. Se o domínio estiver irrecuperável, verificar um **novo subdomínio** de envio no Resend, trocar `EMAIL_FROM` e reiniciar: o que está `pending` sai pelo novo remetente.
5. **Depois.** Linhas `failed` por bloqueio não são reenviadas sozinhas. Para reenfileirar uma específica depois de resolvido: `update email_outbox set status = 'pending', attempts = 0, next_attempt_at = now(), last_error = null where id = '<id>' and status = 'failed' and to_address <> '';` (linhas com mais de 30 dias já perderam endereço e payload e não dá para reenviar). Endereços suprimidos por bounce continuam suprimidos (`select * from email_suppressions where address = '...'`); remover uma linha dali só se o endereço comprovadamente voltou a funcionar.
