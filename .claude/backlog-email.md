# Backlog — Gateway de e-mail (Resend)

Backlog executável derivado de `.claude/plano-gateway-email.md` (análise + as 9 decisões D1–D9 fechadas pelo autor em 2026-10-09). Mesma relação que `backlog-app-mobile.md` tem com `arquitetura-app-mobile-react-native-webview.md`: o plano é o "porquê" e a fonte dos desenhos (seção 4: arquitetura, outbox, tokens, DNS, templates, webhook), este arquivo quebra isso em tarefas, uma por sessão. **Antes de pegar uma tarefa, leia a seção correspondente do plano; não redecida nada que as D1–D9 já fecharam.**

**Como usar este arquivo**

1. Siga a ordem da "Sequência sugerida" no final. Dependências reais estão em cada tarefa.
2. Uma tarefa por sessão. Ao concluir: verificar os critérios de aceite, marcar ✅ no título e acrescentar um bullet **Entregável** (mesmo padrão dos outros backlogs).
3. **Toda tarefa toca `backend/`** (e várias o `frontend/`): passa pelo checklist obrigatório do `CLAUDE.md` inteiro (regra em `domain/`/`application/`, port em `application/ports/` + adapter em `infrastructure/`, Zod na borda, teste no mesmo commit, `.docs/backend/<módulo>.md`, lint/build/test, `docker compose up`). Nenhuma toca `engine/`.
4. Telas novas nascem responsivas nos três breakpoints e seguem `identidade-visual-tokens.md`. Texto mostrado ao usuário (inclusive o corpo dos e-mails) nunca usa "—" como pontuação.
5. Nenhum e-mail pode expor patrimônio absoluto de outro usuário (RNF09). Conta anonimizada (`@anonimo.invalid`) nunca recebe e-mail.
6. **Pré-requisitos do autor, fora do código:** escolher o domínio de envio e configurar SPF/DKIM/DMARC no Resend (plano 4.6) antes da EM.1.4 ser validada com envio real; criar a chave de API (só permissão de envio, uma por ambiente); conferir limites e preço atuais do Resend.
7. O módulo novo é `backend/src/modules/notifications/`. Migrations Drizzle: atenção à regra do `when` do journal (memória `drizzle-journal-when-must-increase`) e a `drizzle-kit generate` precisar de TTY.

## Decisões já fechadas (resumo, detalhe na seção 6 do plano)

D1 Resend atrás de port · D2 conta por e-mail e senha só loga com e-mail verificado; Google loga direto · D3 vínculo Google com conta local não verificada zera a senha local · D4 conta só-Google pede reset: reset normal que cria a primeira senha · D5 templates em funções TS puras · D6 troca de e-mail continua bloqueada · D7 admin não redefine senha por e-mail · D8 e-mail de engajamento é opt-in · D9 streak em risco por e-mail permitido só como convite, opt-in.

---

## Fase A, fundação (nenhum e-mail ao usuário ainda)

### EM.1.1 · Port, outbox e worker
- **Descrição:** módulo `notifications` (domain/application/infrastructure), tabela `email_outbox` (+ migration), `EnqueueEmailUseCase` (decide por categoria, supressão, `.invalid`; idempotente por `idempotency_key`), `DeliverPendingEmailsUseCase` (lote com `FOR UPDATE SKIP LOCKED`, retry com backoff 1 min/5/30/2 h até 5 tentativas, recupera `sending` preso), scheduler no formato do `payrollScheduler` (cadência ~5 s), `fakeEmailSender`. Plano 4.2 e 4.3.
- **Dependências:** nenhuma.
- **Aceite:** testes de enfileiramento idempotente, retry/backoff, recuperação de linha presa, `SKIP LOCKED` (integração com Postgres real, como os `*.integration.test.ts` existentes); `.invalid` recusado por construção.

### EM.1.2 · Adapters `resend` e `log` + configuração
- **Descrição:** `resendEmailSender` (único arquivo que importa o SDK; 4xx permanente vs 429/5xx transitório; `Idempotency-Key` = id do outbox), `logEmailSender` (só com `EMAIL_PROVIDER=log`), variáveis no composition e no `docker-compose.yml` (`EMAIL_PROVIDER`, `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, `EMAIL_FROM`, `EMAIL_REPLY_TO`, `EMAIL_SEND_RPS`, `EMAIL_OUTBOX_INTERVAL_MS`); falha cedo na subida em produção sem chave. Plano 4.5.
- **Dependências:** EM.1.1.
- **Aceite:** teste do adapter mockando só o SDK; envio real de um e-mail de teste (manual, domínio verificado); processo não sobe com `EMAIL_PROVIDER=resend` sem chave.

### EM.1.3 · Base de templates
- **Descrição:** layout HTML + texto compartilhado, escape de toda variável, cores literais de `identidade-visual-tokens.md`, modo escuro com fallback claro, cabeçalhos de transacional vs. não transacional (`List-Unsubscribe` só no segundo). Plano 4.7.
- **Dependências:** EM.1.1.
- **Aceite:** teste de que `<script>` no nome do usuário sai escapado; sem "—" nos textos; pré-visualização HTML gerada em `tmp/` aprovada pelo autor.

### EM.1.4 · Webhook, supressão e domínio
- **Descrição:** `POST /webhooks/resend` montado antes do `express.json()` com `express.raw`, verificação de assinatura Svix, tabela `email_suppressions`, consulta de supressão no `EnqueueEmailUseCase`; autor configura o DNS (plano 4.6). Eventos: `delivered`, `bounced` (permanente suprime), `complained` (suprime e desliga categorias opcionais), `delivery_delayed` (log). Plano 4.8 e 4.9. **Precede qualquer envio real a usuário.**
- **Dependências:** EM.1.1, EM.1.2.
- **Aceite:** assinatura inválida => 400; bounce permanente suprime; evento repetido é no-op; `.docs/backend/notifications.md` criado com o contrato do webhook.

---

## Fase B, recuperação de senha (P0)

### EM.2.1 · Tokens e casos de uso de reset
- **Descrição:** tabela `auth_email_tokens` (hash SHA-256, `kind`, `expires_at`, `used_at`), `RequestPasswordResetUseCase`, `ResetPasswordUseCase` (grava senha, marca e-mail verificado, `revokeSessions`, enfileira o aviso E4), port `AuthMailer` em `auth/application/ports/` com adapter para o módulo `notifications`. Reset TTL 30 min, uso único, novo pedido invalida os anteriores. Plano 4.4.
- **Dependências:** EM.1.1, EM.1.3.
- **Aceite:** token expirado e já usado recusados; resposta igual para e-mail existente e inexistente; admin recusado e registrado no `admin_audit_log` (D7); conta só-Google recebe o reset normal e cria a primeira senha (D4); só o hash vai pro banco.

### EM.2.2 · Rotas, rate limit e documentação
- **Descrição:** `POST /auth/forgot-password` (sempre `202`) e `POST /auth/reset-password`, Zod na borda, `createRateLimiter` por IP e por e-mail normalizado, `.docs/backend/auth.md`.
- **Dependências:** EM.2.1.
- **Aceite:** supertest cobrindo `202`, `400`, `401/410` de token inválido/expirado, `429` com `Retry-After`; link montado como `${FRONTEND_URL}/redefinir-senha#token=...`.

### EM.2.3 · Telas "Esqueci minha senha" e "Redefinir senha"
- **Descrição:** duas telas nos três breakpoints, link no `Login`, leitura do token do fragmento, validação 8–72 caracteres, atualização do `inventario-telas-plataforma-investimentos.md`.
- **Dependências:** EM.2.2.
- **Aceite:** fluxo ponta a ponta no `docker compose up` com `EMAIL_PROVIDER=log` e depois com Resend real; sessões antigas deslogadas após o reset.

---

## Fase C, verificação de e-mail e fechamento do ponto 043 (P0)

### EM.3.1 · Coluna, verificação e login bloqueado (D2)
- **Descrição:** `users.email_verified_at`; `SendEmailVerificationUseCase`/`VerifyEmailUseCase` com reenvio e teto (TTL 24 h); `RegisterUserUseCase` deixa de devolver token e responde "verifique seu e-mail"; `LoginUserUseCase` recusa conta não verificada com `403 { error: "email_not_verified" }` só depois de a senha conferir; seed do admin e login Google já nascem verificados; `PATCH /me` deixa de aceitar `email` (D6).
- **Dependências:** EM.1.1, EM.1.3, EM.2.1 (reutiliza `auth_email_tokens`).
- **Aceite:** testes de casos de uso; migration aplicada em base vazia (sem backfill, banco só de desenvolvimento); e2e de `backend/test/e2e` ajustados para registrar já verificado; falha de envio nunca derruba o cadastro (e-mail fica no outbox); `.docs/backend/auth.md` atualizado.

### EM.3.2 · Vínculo Google seguro (fecha o ponto 043)
- **Descrição:** `GoogleProfile.emailVerified` lido do ID token; `LoginWithGoogleUseCase` só vincula conta local existente com `emailVerified`; se a conta local não estava verificada, zera `password_hash` e marca verificada (D3).
- **Dependências:** EM.3.1.
- **Aceite:** teste reproduzindo o pré-sequestro (conta local não verificada + Google) e mostrando que a senha do atacante deixa de funcionar; Google sem `email_verified` não vincula; marcar o ponto 043 como ✅ em `pontos-em-aberto-decisao-produto.md`.

### EM.3.3 · Telas de verificação
- **Descrição:** tela `Verificar e-mail` (estados sucesso/expirado/já usado), aviso "enviamos um link" pós-cadastro no lugar do login automático, estado do `Login` para `email_not_verified` com botão de reenviar (teto por e-mail e por IP), `AuthContext` tratando o novo `403`.
- **Dependências:** EM.3.1.
- **Aceite:** quem não verificou nunca fica sem caminho (reenviar sempre visível); fluxo ponta a ponta com `EMAIL_PROVIDER=log` e com Resend real; três breakpoints.

---

## Fase D, avisos de segurança

### EM.4.1 · Avisos de senha alterada e sessões encerradas (E4)
- **Descrição:** troca de senha (`ChangePasswordUseCase`), reset concluído e "forçar logout" do admin (`forceLogoutUser`) enfileiram o aviso "não foi você? redefina a senha".
- **Dependências:** EM.2.1.
- **Aceite:** um e-mail por evento, idempotente, sem token no corpo.

---

## Fase E, ciclo de vida (P1)

### EM.5.1 · Boas-vindas, suspensão/reativação, exclusão e exportação (E5, E6, E7, E10)
- **Descrição:** boas-vindas depois da verificação, aviso de suspensão (com motivo e como contestar) e de reativação, confirmação de exclusão de conta e de exportação, aviso de crédito/correção feita pelo admin.
- **Dependências:** EM.3.1.
- **Aceite:** exclusão envia a confirmação ao endereço **antes** da anonimização; suspenso recebe só o aviso de suspensão e nada opcional; `.invalid` recusado por construção.

### EM.5.2 · Comunicado crítico e manutenção (E9)
- **Descrição:** `announcements` ganha flag `notifyByEmail`; envio em lote via outbox, só a quem é verificado, respeitando `EMAIL_SEND_RPS`.
- **Dependências:** EM.1.4, EM.3.1.
- **Aceite:** enviar para N usuários não estoura a cota nem trava o worker; migration e `.docs/backend/announcements.md` atualizados.

---

## Fase F, preferências e social (P1/P2)

### EM.6.1 · Preferências e descadastro
- **Descrição:** `email_preferences`, rotas `GET/PATCH /me/email-preferences` e `POST /email/unsubscribe` (token HMAC; `GET` só mostra a confirmação), `List-Unsubscribe` + `List-Unsubscribe-Post`, tela em Configurações, página pública de descadastro, pergunta de opt-in no onboarding (tela 1.2, D8), `GET /me/export` e `AnonymizeAccountUseCase` atualizados. **Precede qualquer e-mail não transacional.**
- **Dependências:** EM.1.4, EM.3.1.
- **Aceite:** engajamento nasce desligado; descadastrar um clique funciona sem login; anonimizar limpa preferências e linhas do outbox; três breakpoints.

### EM.6.2 · Pedido de amizade recebido/aceito (E8)
- **Descrição:** e-mail só com username, nível e rentabilidade percentual (nunca patrimônio absoluto, RNF09), opt-in do destinatário.
- **Dependências:** EM.6.1.
- **Aceite:** spam de pedidos não gera mais de 1 e-mail por dia por destinatário.

---

## Fase G, engajamento (P2, só depois da Fase F)

### EM.7.1 · Resumo semanal (E12)
- **Descrição:** job semanal lendo `ranking_snapshots`; só percentuais, nível e missão pendente.
- **Dependências:** EM.6.1.
- **Aceite:** só opt-in; nenhum valor absoluto de patrimônio; tom de evolução, não de perda.

### EM.7.2 · Salário mensal e conquista rara (E11, E14)
- **Descrição:** aviso do salário creditado pelo job `payroll` e de conquista rara desbloqueada.
- **Dependências:** EM.6.1.
- **Aceite:** só opt-in, idempotente por evento (mês/conquista).

### EM.7.3 · Streak em risco como convite (E13, D9)
- **Descrição:** job diário, só opt-in, teto de 1 e-mail por dia, não envia a quem já cumpriu a atividade do dia nem a conta suspensa. Texto neutro ("sua sequência segue de pé até hoje, quer uma lição rápida?").
- **Dependências:** EM.7.1 (medir cancelamento e reclamação antes).
- **Aceite:** tom sem escassez nem culpa, revisado contra `proposta-engajamento-licoes.md`.

---

## Fase H, operação e conformidade

### EM.8.1 · Saúde do outbox no admin e retenção
- **Descrição:** contadores (pendentes, falhas, pendente mais antigo) em `GetSystemHealthUseCase` e `AdminSistema`; limpeza de `payload`/`to_address` de linhas `sent`/`failed` com mais de 30 dias.
- **Dependências:** EM.1.1.
- **Aceite:** alerta visual com pendente mais velho que 10 min; teste da limpeza; `.docs/backend/admin.md` atualizado.

### EM.8.2 · LGPD e documentação
- **Descrição:** `PrivacidadeLgpd` e política citando o operador (Resend, transferência internacional), `.docs/backend/notifications.md` completo, `especificacao-plataforma-investimentos.md` (RFs novos) e inventário de telas atualizados, runbook curto ("como rotacionar a chave", "o que fazer se o domínio entrar em lista de bloqueio").
- **Dependências:** EM.6.1 (e as telas novas).
- **Aceite:** documentos coerentes com o que foi entregue; changelog da spec com a decisão.

---

## Sequência sugerida

`EM.1.1 → 1.2 → 1.3 → 1.4 → 2.1 → 2.2 → 2.3 → 3.1 → 3.2 → 3.3 → 4.1 → 5.1 → 6.1 → 6.2 → 5.2 → 8.1 → 8.2 → 7.1 → 7.2 → 7.3`

Fases A–C (P0) fecham o essencial e o risco de segurança; a recuperação de senha (B) é o primeiro ganho visível. A Fase G só começa depois de medir cancelamento e reclamação com o volume da F. Cada tarefa terminada marca ✅ aqui e em `backlog-pendencias-consolidado.md`.
