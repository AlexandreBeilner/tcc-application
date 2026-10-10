# Plano — gateway de e-mail (Resend)

> **Proposta com decisões fechadas** (as nove da seção 6 foram respondidas pelo autor em 2026-10-09): análise feita antes de qualquer implementação. Nada aqui está construído. O achado de segurança da seção 2.1 está registrado como ponto 043 em `pontos-em-aberto-decisao-produto.md`. As tarefas da seção 8 já refletem as decisões e podem virar backlog executável (mesma disciplina de sessão-por-tarefa dos outros backlogs).

---

## 1. Estado atual (verificado no código, 2026-10-09)

- **Não existe nenhum envio de e-mail.** Sem dependência (`backend/package.json` só tem `bcryptjs`, `google-auth-library`, `jsonwebtoken`, `ioredis`, etc.), sem variável de ambiente, sem port, sem tabela. O `docker-compose.yml` não tem serviço de e-mail.
- **O e-mail é só identificador.** Cadastro (`RegisterUserUseCase`) grava o e-mail sem confirmar que ele pertence a quem digitou. Não há coluna `email_verified_at` em `users`.
- **Não existe recuperação de senha.** A tela de Login não tem "esqueci minha senha"; quem perde a senha local perde a conta. Conta criada só pelo Google (`password_hash = NULL`) pode criar a primeira senha só estando logada (`POST /me/password`).
- **Troca de e-mail está desligada na prática.** `PATCH /me` aceita `email` (contrato e `UpdateProfileUseCase` já tratam conflito), mas o frontend (`pages/Configuracoes`) mostra o campo `readOnly disabled` e não envia mais o campo. Sem confirmação por e-mail, liberar isso seria perigoso.
- **Eventos que já acontecem e o usuário só descobre por acaso:** suspensão pelo admin (`SuspendUserUseCase`; o usuário só vê o `403 account_suspended` ao tentar logar), "forçar logout" (`forceLogoutUser`), exclusão/anonimização de conta (`DELETE /me`), troca de senha (`ChangePasswordUseCase`), pedido de amizade recebido (`SendFriendRequestUseCase`), folha de pagamento mensal (job `payroll`), ranking recalculado a cada 3 h (job `ranking`), comunicados/manutenção (`announcements`, só faixa no app).
- **Infra que dá pra reaproveitar:** padrão de job agendado em processo (`startPayrollScheduler`, `startRankingSnapshotScheduler`: `setInterval` + trava `running` + log de falha sem derrubar o processo), rate limit em memória por IP (`shared/http/rateLimit.ts`), `app.set('trust proxy', 1)`, token de sessão com `tokenVersion` (`revokeSessions` já invalida todos os tokens), `FRONTEND_URL` no ambiente, fragmento `#token=` no callback do Google (padrão a repetir nos links de e-mail), Redis no Compose.
- **Pegadinha de LGPD já documentada:** `AnonymizeAccountUseCase` troca o e-mail por `usuario-removido-<id>@anonimo.invalid`. O envio precisa recusar domínio `.invalid` por construção (não depender de lembrar disso em cada caso de uso).

## 2. Achado de segurança que o gateway precisa fechar

### 2.1 Vínculo do Google por e-mail sem verificação (pré-sequestro de conta)

`LoginWithGoogleUseCase` casa por e-mail uma conta local já existente e cria a identidade nova, **sem checar `email_verified` do Google** (o adapter nem lê esse campo, `googleIdentityProviderAdapter.ts`) e **sem que o cadastro local tenha verificado o e-mail**. Cenário: um atacante se cadastra com `vitima@gmail.com` e uma senha dele; quando a vítima entra com o Google, o sistema vincula a identidade dela à conta do atacante, que continua sabendo a senha e fica com a conta (e todo o progresso dela) acessível. Confirmar o e-mail no cadastro (seção 4.4) e exigir `email_verified = true` do Google fecha o ataque. Registrado como ponto 043 porque a política do que fazer com a senha local da conta pré-existente é decisão de produto (D3).

## 3. O que a aplicação precisa de e-mail (mapeamento)

Prioridade: **P0** = a aplicação está incompleta/insegura sem isso; **P1** = comunicação esperada pelo usuário, baixo risco; **P2** = engajamento, sempre opt-in e com cancelamento; **P3** = depende de decisão futura.

| # | Caso | Gatilho no código de hoje | Categoria | Prio |
|---|---|---|---|---|
| E1 | **Recuperação de senha** (link com token de uso único) | não existe; novo `POST /auth/forgot-password` + `POST /auth/reset-password` | transacional/segurança | P0 |
| E2 | **Verificação de e-mail** no cadastro e no vínculo Google | `RegisterUserUseCase`; `LoginWithGoogleUseCase` | transacional/segurança | P0 |
| E3 | ~~Confirmação de troca de e-mail~~ **fora de escopo (D6: a troca de e-mail continua bloqueada)** | `UpdateProfileUseCase` | n/a | n/a |
| E4 | **Aviso de senha alterada / sessões encerradas** ("não foi você? redefina") | `ChangePasswordUseCase`, reset concluído, `forceLogoutUser` | transacional/segurança | P0 |
| E5 | Boas-vindas (pós-verificação, com o primeiro passo da trilha) | `RegisterUserUseCase` | transacional leve | P1 |
| E6 | **Conta suspensa / reativada** (motivo registrado pelo admin, como contestar) | `SuspendUserUseCase`, `ReactivateUserUseCase` | transacional | P1 |
| E7 | **Confirmação de exclusão de conta** (LGPD, prova de que foi pedida) e de exportação | `AnonymizeAccountUseCase`, `GET /me/export` | transacional/LGPD | P1 |
| E8 | Pedido de amizade recebido / aceito | `SendFriendRequestUseCase`, `RespondToFriendRequestUseCase` | social, opt-in | P1 |
| E9 | Comunicado crítico e manutenção programada | `announcements` (`kind = maintenance`, `severity = critical`) | operacional | P1 |
| E10 | Crédito de caixa/correção feita pelo admin na conta | `creditUserCash`, `userCorrections` | transacional | P1 |
| E11 | Salário mensal creditado (nível/folha) | job `payroll` | engajamento, opt-in | P2 |
| E12 | Resumo semanal: posição no ranking, XP, streak, missão pendente | job de resumo novo, lendo o snapshot do ranking | engajamento, opt-in | P2 |
| E13 | Streak prestes a zerar, como convite | `user_progression.last_qualifying_activity_date` | engajamento, opt-in, **sob o limite ético** (ver 7) | P2 |
| E14 | Conquista rara desbloqueada, evento macro relevante pra carteira | `achievements`, `news` | engajamento, opt-in | P2 |
| E15 | Recibo/falha de cobrança, aviso de cancelamento de plano PRO | futuro módulo `billing` (`analise-tecnica-monetizacao.md`); o Stripe já manda recibo próprio | transacional | P3 |
| E16 | Resposta de suporte / contato do autor | fora de escopo (não há tela de contato) | — | P3 |

Também precisa existir, mesmo sem ser um "caso" próprio: **cancelar inscrição** (link em todo e-mail não transacional), **preferências por categoria** (tela em Configurações) e **lista de supressão** (bounce, reclamação de spam, descadastro) alimentada pelo webhook do provedor. Sem isso não se pode enviar nenhum e-mail de P1 social/P2 sem prejudicar a reputação do domínio.

### 3.1 Pontos de atenção por caso

- **E8/E12 e o RNF09:** o e-mail nunca leva patrimônio absoluto de outro usuário; só rentabilidade percentual, nível, conquistas e username (mesma regra do ranking e do perfil público). O próprio patrimônio do destinatário em e-mail pessoal é permitido, mas **não vale a pena**: e-mail fica indexado em caixa de entrada; prefira "veja sua carteira" com link.
- **E8 e abuso:** qualquer usuário pode mandar pedido de amizade a qualquer outro (perfil público). Sem limite, vira vetor de spam usando o nosso domínio. Teto de 1 e-mail social por destinatário por dia, só para destinatário com e-mail verificado e opt-in.
- **E13:** ver seção 7. Só convite, nunca "você vai perder"; só para quem ligou engajamento (D8) e no máximo 1 e-mail por dia.
- **Conta anonimizada/`.invalid` e conta suspensa:** nunca recebem e-mail de P1 social/P2 (a suspensa recebe só E6).

## 4. Desenho técnico

### 4.1 Por que Resend (e o que NÃO acoplar a ele)

- API simples (`POST /emails`), SDK Node oficial (`resend`), verificação de domínio com SPF/DKIM guiada, webhooks de entrega/bounce/spam (assinados via Svix), cabeçalho `Idempotency-Key` aceito, plano gratuito suficiente pro volume de protótipo. **Conferir limites e preço atuais no site do Resend na hora de implementar** (cota diária/mensal e requisições por segundo mudam; o plano abaixo assume algo da ordem de 2 req/s por padrão e trata isso como parâmetro, não como constante).
- Alternativas consideradas: SES (mais barato em volume, mais trabalho de setup/sandbox), Postmark (excelente entregabilidade transacional, mais caro), SMTP genérico via `nodemailer` (sem webhook de bounce, pior). Como o código fala só com uma port (4.2), trocar de provedor é trocar um adapter, sem tocar em regra de negócio.

### 4.2 Arquitetura (DDD lite, seguindo `arquitetura-backend-ddd-lite.md`)

Novo módulo `backend/src/modules/notifications/`, dono de tudo que é entrega de e-mail. **Os módulos de negócio não conhecem o Resend nem o módulo `notifications` por dentro**: cada um declara uma port mínima na própria `application/ports/` (mesmo padrão de `AccountProvisioner` e dos exporters em `auth`), implementada por um adapter em `infrastructure/notifications/` que chama o caso de uso de enfileirar. Ex.: `auth/application/ports/authMailer.ts` com `sendPasswordReset(to, link, expiresAt)`, `sendEmailVerification(...)`, `sendPasswordChanged(...)`.

```
modules/notifications/
  domain/
    emailMessage.ts          # EmailCategory ('security'|'transactional'|'social'|'engagement'), EmailTemplateKey, regras (categoria exige opt-in?)
    errors.ts
    templates/               # funções puras: (data) => { subject, html, text }, uma por template, escapando toda variável
  application/
    ports/
      emailSender.ts         # send(message): Promise<{ providerMessageId }>  (transporte: Resend, log, fake)
      emailOutboxRepository.ts
      emailSuppressionRepository.ts
      emailPreferencesRepository.ts
      recipientDirectory.ts  # status/anonimizado/verificado do destinatário, sem importar o módulo auth
    useCases/
      enqueueEmail.ts        # decide pela categoria + supressão + preferência + .invalid; grava no outbox; idempotente
      deliverPendingEmails.ts # worker: reivindica lote, envia, marca sent/failed, agenda retry
      handleProviderWebhook.ts # delivered/bounced/complained -> supressão e status
      updateEmailPreferences.ts / unsubscribeByToken.ts
  infrastructure/
    resend/resendEmailSender.ts        # único arquivo que importa o SDK; mapeia erro 4xx permanente vs 5xx/429 transitório
    log/logEmailSender.ts              # dev/test sem chave: escreve no console (só em EMAIL_PROVIDER=log)
    persistence/drizzle*.ts
    scheduler/emailOutboxScheduler.ts  # mesmo formato do payrollScheduler
  interfaces/http/
    webhookRouter.ts         # POST /webhooks/resend (corpo bruto, assinatura Svix)
    preferencesRouter.ts     # GET/PATCH /me/email-preferences; POST /email/unsubscribe (token)
  test/fakes/                # fakeEmailSender (guarda o que "enviou"), fakeOutbox, etc.
  composition.ts             # igual a payroll/ranking: wiring e retorno dos casos de uso
```

### 4.3 Outbox transacional (não enviar dentro da requisição)

**Decisão: tabela `email_outbox` no Postgres + worker**, não envio direto no caso de uso e não fila externa (BullMQ/Redis).

- **Por quê não direto:** latência do provedor entra no `POST /auth/register`; falha do Resend não pode derrubar cadastro (hoje o cadastro falha se o motor falhar, porque a conta financeira é obrigatória; e-mail não é); sem retry; sem trilha de auditoria.
- **Por quê não BullMQ:** dependência e operação novas pra um volume pequeno; o outbox grava a linha **na mesma transação** da escrita de negócio (token criado + e-mail enfileirado ou nenhum dos dois), coisa que uma fila no Redis não dá.
- **Tabela `email_outbox`:** `id uuid`, `user_id uuid null` (FK `users`), `to_address`, `template_key`, `category`, `payload jsonb` (só o que o template precisa; nunca token em claro depois de enviado, ver 4.4), `idempotency_key text UNIQUE` (ex.: `password-reset:<tokenId>`, `friend-request:<friendshipId>`), `status` (`pending|sending|sent|failed|suppressed`, texto + CHECK como `users.status`), `attempts`, `next_attempt_at`, `provider_message_id`, `last_error`, `created_at`, `sent_at`. Índice parcial em `(next_attempt_at) WHERE status = 'pending'`.
- **Worker:** `deliverPendingEmails` reivindica um lote com `SELECT ... FOR UPDATE SKIP LOCKED` (seguro mesmo com mais de uma réplica), envia respeitando o limite de requisições por segundo do provedor (parâmetro `EMAIL_SEND_RPS`), usa a própria `id` da linha como `Idempotency-Key` do Resend (reenvio após crash não duplica), classifica erro: 4xx permanente (endereço inválido) => `failed` sem retry; 429/5xx/timeout => backoff exponencial (1 min, 5, 30, 2 h) até 5 tentativas. Cadência curta (5 s) porque recuperação de senha é sensível a tempo; conclui rápido quando a fila está vazia. Linhas `sending` presas por mais de N minutos voltam a `pending` (recuperação de crash).
- **Retenção:** `payload` e `to_address` de linhas `sent`/`failed` com mais de 30 dias são limpos pelo mesmo job (minimização de dados, LGPD); a linha mínima (id, template, status, datas) fica para auditoria.

### 4.4 Tokens de e-mail (reset, verificação, troca)

Tabela `auth_email_tokens`: `id`, `user_id`, `kind` (`password_reset|email_verification|email_change`), `token_hash` (SHA-256 do token), `new_email null` (só `email_change`), `expires_at`, `used_at null`, `created_at`.

- Token = 32 bytes de `crypto.randomBytes` em base64url; **só o hash é guardado**; uso único (`used_at`); pedir um novo invalida os anteriores do mesmo `kind`. TTL: reset 30 min, verificação 24 h, troca de e-mail 24 h.
- O token em claro só existe no link montado na hora de enfileirar; **o payload do outbox guarda o link já montado e é apagado/ofuscado quando o status vira `sent`** (ou o worker recebe o token por uma port efêmera). Detalhe a fechar na tarefa EM.2.
- **Link no fragmento:** `${FRONTEND_URL}/redefinir-senha#token=...` (igual ao callback do Google): o fragmento não vai pro servidor, nem pro `Referer`, nem pro log do gateway/nginx.
- **Sem enumeração de e-mail:** `POST /auth/forgot-password` sempre responde `202` com a mesma mensagem, exista ou não a conta (hoje o login já devolve mensagem genérica de propósito; manter o princípio). Como o trabalho pesado é só gravar no outbox, o tempo de resposta também não vaza. Conta só-Google que pede reset recebe o **mesmo e-mail e link de reset** (D4): o link define a primeira senha, e a conta passa a ter os dois métodos de login (mesma ideia do `ChangePasswordUseCase`, que já aceita a primeira senha sem `currentPassword`).
- **Rate limit:** reaproveitar `createRateLimiter` com `keyOf` por IP **e** por e-mail normalizado (hash), mais teto diário por usuário no outbox. O limiter atual é em memória e por instância (já documentado em `rateLimit.ts`); se o backend virar várias réplicas, migra pro Redis, como o próprio arquivo prevê.
- **Ao concluir o reset:** atualiza `password_hash`, marca o e-mail como verificado (quem leu o link provou o controle da caixa), chama `revokeSessions` (`tokenVersion++`, encerra todas as sessões) e enfileira E4. Conta `role = admin` **não** redefine senha por e-mail (admin tem reautenticação própria, N.22, e seed manual): recusar e alertar no log de auditoria (D7).
- **Verificação de e-mail:** nova coluna `users.email_verified_at timestamptz null`. Google com `email_verified = true` já nasce verificado. `google-auth-library` expõe o campo no payload do ID token; o adapter passa a ler e `GoogleProfile` ganha `emailVerified`.
- **Vínculo Google (fecha 2.1):** só vincula conta local existente se `profile.emailVerified`. Se a conta local **não** estava verificada, o vínculo zera `password_hash` (o atacante perde o acesso) e marca verificada; se estava verificada, vincula normal (D3).

### 4.5 Configuração e ambientes

Variáveis (Compose usa o padrão `${VAR:-}` já adotado pro Google): `EMAIL_PROVIDER` (`resend` | `log`), `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, `EMAIL_FROM` (ex.: `Nome da plataforma <no-reply@mail.dominio>`), `EMAIL_REPLY_TO`, `EMAIL_SEND_RPS`, `EMAIL_OUTBOX_INTERVAL_MS`, `APP_PUBLIC_URL` (hoje só existe `FRONTEND_URL`; reaproveitar essa).

- Sem `RESEND_API_KEY`, o composition cai no `logEmailSender` **só se `EMAIL_PROVIDER=log`** (dev local imprime assunto e link no console para testar reset sem provedor). Em produção, falta de chave com `EMAIL_PROVIDER=resend` é erro de inicialização do processo (falha cedo e visível), diferente do provider "desabilitado" do Google, que só quebra na requisição.
- O log do `logEmailSender` **nunca é usado em produção** (imprimiria token). Testes automatizados usam o `fakeEmailSender`, nunca rede.
- Chave do Resend com permissão só de envio (`sending_access`), e uma por ambiente.
- `docker-compose.yml` ganha as variáveis no serviço `backend`; **nenhum container novo** (Resend é SaaS, o worker roda no processo do backend como os outros dois jobs).

### 4.6 Entregabilidade e DNS (o que o autor precisa fazer fora do código)

- Domínio próprio e **subdomínio dedicado** ao envio (ex.: `mail.<dominio>`): isola a reputação do domínio principal. Transacional e engajamento em **subdomínios separados** (`send.` e `news.`) para que reclamação de um e-mail de resumo semanal não derrube a entrega do reset de senha.
- Registros SPF e DKIM fornecidos pelo Resend, **DMARC** (`p=none` com relatório no começo, subir para `quarantine` quando estável), e Return-Path alinhado.
- **Desligar rastreio de abertura e de clique** nos e-mails de segurança (reescrever o link do reset por um domínio de terceiros é ruim pra confiança e pode vazar o token).
- E-mails não transacionais levam `List-Unsubscribe` e `List-Unsubscribe-Post: List-Unsubscribe=One-Click` (exigência de Gmail/Yahoo para remetentes em volume) + link de cancelar no rodapé + endereço de contato.
- Toda mensagem leva versão **texto puro** junto do HTML; assunto sem emoji nem CAIXA ALTA; remetente consistente.
- Não existe envio para o domínio de testes do Resend em produção; antes do domínio verificado só dá pra enviar para o e-mail da própria conta Resend. Em desenvolvimento use `EMAIL_PROVIDER=log`.

### 4.7 Templates

- Funções TypeScript puras em `notifications/domain/templates/`, `(dados) => { subject, html, text }`, **escapando toda variável interpolada** (nome de usuário vem do usuário: XSS/HTML injection em e-mail é real), HTML com tabelas e CSS inline, largura 600 px, suportando modo escuro por `prefers-color-scheme` com fallback claro. Cores vêm de `identidade-visual-tokens.md` (valores literais, e-mail não resolve variável CSS).
- Sem biblioteca de template/React Email na primeira entrega (D5): são 6–8 templates, funções puras são testáveis com um `expect` por assunto e por link, e não adicionam build. Reavaliar se passar de ~15.
- **Texto de e-mail é copy de interface:** a regra da memória do projeto vale (nunca "—" como pontuação no texto mostrado ao usuário). Tom segue `diretrizes-redacao-licoes.md` (claro, sem jargão antes de definir) e o limite ético de engajamento (7).

### 4.8 Webhook do provedor

`POST /webhooks/resend` precisa do **corpo bruto** para verificar a assinatura Svix. Hoje `express.json()` é global em `app.ts` (linha ~751): a rota do webhook tem de ser montada **antes** dele com `express.raw({ type: 'application/json' })` (mesma armadilha já anotada para o Stripe em `analise-tecnica-monetizacao.md`; uma solução vale para os dois). Eventos tratados: `email.delivered` (marca `sent` confirmado), `email.bounced` (permanente => supressão `bounce`), `email.complained` (supressão `complaint` + desliga todas as categorias não obrigatórias), `email.delivery_delayed` (só log). Validação de assinatura é a "validação Zod" dessa rota; idempotente por id do evento. Sem sessão, sem JWT; rota fora do `authMiddleware`.

### 4.9 Preferências, descadastro e supressão

- `email_preferences` (`user_id` PK): uma coluna booleana por categoria opcional (`social`, `engagement`); segurança e transacional **não são desligáveis** (reset, verificação, suspensão, exclusão).
- `email_suppressions` (`address` único em minúsculo, `reason` `bounce|complaint|unsubscribe_all`, `created_at`): consultada em **todo** enfileiramento, inclusive transacional (endereço com bounce permanente não adianta tentar de novo; o sistema devolve ao usuário um aviso in-app "não conseguimos entregar e-mails para este endereço" na tela Configurações).
- Descadastro de um clique: token assinado (HMAC, sem login) no link do rodapé e no `List-Unsubscribe`; `POST /email/unsubscribe` (e `GET` que só mostra a página de confirmação, para scanners de e-mail que "clicam" no link não descadastrarem sozinhos).
- Exportação e exclusão: `GET /me/export` ganha `emailPreferences`; `AnonymizeAccountUseCase` remove preferências e limpa linhas do outbox do usuário (a supressão do endereço original é mantida só por hash, para não voltar a enviar para o mesmo endereço se ele for reutilizado).

### 4.10 Frontend

Telas novas (entram no `inventario-telas-plataforma-investimentos.md`, hoje 28 mais as do admin): **Esqueci minha senha**, **Redefinir senha** (lê o token do fragmento, valida 8–72 caracteres, mesma regra do cadastro), **Verificar e-mail** (consome o token, estados sucesso/expirado/já usado, reenviar) e a tela "enviamos um link para o seu e-mail" que substitui o login automático depois do cadastro, **Preferências de e-mail** dentro de Configurações (mais página pública de descadastro sem login). Ajustes: link "Esqueci minha senha" em `Login`; tela de login bloqueado com "reenviar verificação" (D2); aviso de endereço suprimido em Configurações; texto de `PrivacidadeLgpd` e da política citando o operador de e-mail. Responsividade nos três breakpoints como toda tela nova (`CLAUDE.md`).

### 4.11 App mobile (WebView)

Os links de e-mail abrem no navegador do aparelho, não no app. Aceitável na primeira entrega (reset e verificação concluem na web e a sessão volta no app por login). Universal Links/App Links (abrir direto no app) ficam como melhoria registrada em `backlog-app-mobile.md`, não bloqueiam este plano. Login Google nativo (Fase 3 do mobile) reaproveita a mesma regra `emailVerified` da 4.4.

### 4.12 Observabilidade e administração

- Contadores do outbox (pendentes, falhas, mais antigo pendente) entram em `GetSystemHealthUseCase` e na tela `AdminSistema` (já existente); alerta visual se há `pending` mais velho que 10 min ou `failed` acumulando.
- Ações de admin que geram e-mail (suspender, reativar, creditar) continuam gravando em `admin_audit_log`; o e-mail em si não vai pro log de auditoria (só o `idempotency_key` vai no payload da ação, se útil).
- Log estruturado sem destinatário completo nem token (mascarar `a***@dominio`).

## 5. Boas práticas que o plano assume (checklist de revisão)

1. Envio sempre via outbox transacional, nunca síncrono em requisição.
2. Idempotência de ponta a ponta: `idempotency_key` única no banco **e** `Idempotency-Key` no provedor.
3. Token de e-mail com hash no banco, uso único, expiração curta, link no fragmento, sessões revogadas no reset.
4. Resposta uniforme em fluxos que citam e-mail (anti-enumeração) + rate limit por IP e por e-mail.
5. Categorias com obrigatoriedade explícita; opt-in para social/engajamento; supressão consultada em todo envio.
6. Nenhum dado financeiro de terceiros em e-mail (RNF09); mínimo de dado pessoal no corpo; retenção do payload limitada.
7. Domínio dedicado, SPF/DKIM/DMARC, subdomínios separados por tipo, rastreio desligado no transacional, `List-Unsubscribe` no resto.
8. Port única para o provedor; SDK importado em um arquivo só; teste do adapter mocka só o SDK.
9. Falha de configuração em produção quebra a subida do processo; em dev usa o adapter `log`.
10. Copy de e-mail segue as mesmas regras de texto do app (sem "—", sem escassez artificial, sem jargão antes da definição).

## 6. Decisões do autor (D1–D9), fechadas em 2026-10-09

| # | Decisão | Resposta do autor |
|---|---|---|
| D1 | Provedor | **Resend**, atrás de port (pedido original do autor). |
| D2 | O que e-mail não verificado pode fazer | **Bloquear o login.** Regra do autor: conta criada com e-mail e senha só loga com o e-mail verificado; conta criada com Google loga direto (o Google já verificou). Conta por e-mail e senha só entra depois de confirmar o e-mail (`403 email_not_verified` com reenvio). Google com `email_verified` e reset de senha concluído já contam como verificados. Divergiu da recomendação (bloquear só o social): o plano agora trata o e-mail como dependência do cadastro (ver riscos). |
| D3 | Vínculo Google com conta local não verificada | **Vincular e zerar a senha local**, só com `email_verified` do Google. Fecha o ponto 043. |
| D4 | Conta só-Google pede reset de senha | **Reset normal, o link cria a primeira senha.** A tela responde igual para qualquer e-mail (esconder a opção não é possível sem vazar quem tem conta). Divergiu da recomendação (e-mail sem link). |
| D5 | Template | **Funções TS puras** nesta fase. |
| D6 | Troca de e-mail em Configurações | **Continua bloqueada.** Sem fluxo de confirmação do endereço novo (E3 e a antiga EM.4.2 saíram do plano); `PATCH /me` deixa de aceitar `email`. Divergiu da recomendação. |
| D7 | Reset de senha para `role = admin` | **Negado**; tentativa vai para o `admin_audit_log`. |
| D8 | E-mail de engajamento (E11, E12, E14) | **Opt-in, desligado por padrão**, com pergunta no onboarding (tela 1.2) e em Configurações. |
| D9 | Streak em risco por e-mail | **Permitir como convite, opt-in.** Tom neutro ("sua sequência segue de pé até hoje, quer uma lição rápida?"), só para quem ligou os e-mails de engajamento (D8). |

## 7. Limite ético e produto

`proposta-engajamento-licoes.md` e `estrategia-monetizacao.md` fixam: **nunca escassez artificial, só convite**. Vale para e-mail: sem "última chance", sem contagem regressiva falsa, sem culpa por dia perdido; E13 diz "sua sequência de N dias segue de pé até hoje, quer uma lição rápida?" e o resumo semanal fala de evolução, não de perda. Métricas a olhar antes de ampliar E12–E14: taxa de cancelamento de inscrição, taxa de reclamação de spam do webhook (meta abaixo de 0,1%), e se o abandono da trilha cai ou sobe depois do envio.

## 8. Tarefas (ordem sugerida, uma sessão cada)

Prefixo **EM** (e-mail). Todas seguem o checklist obrigatório do backend em `CLAUDE.md` (camadas, Zod, testes junto, lint/build/test, `.docs/backend/`, `docker compose up`).

### Fase A, fundação (sem nenhum e-mail ao usuário ainda)

- **EM.1.1 · Port, outbox e worker.** Módulo `notifications` (domain/application/infrastructure), tabela `email_outbox` (+ migration, atenção à regra do `when` do journal do Drizzle), `EnqueueEmailUseCase`, `DeliverPendingEmailsUseCase`, scheduler no formato do `payrollScheduler`, `fakeEmailSender`. Aceite: testes de enfileiramento idempotente, retry com backoff, recuperação de linha `sending` presa, lote com `SKIP LOCKED` (teste de integração com Postgres real, como os `*.integration.test.ts` existentes).
- **EM.1.2 · Adapters `resend` e `log` + configuração.** `resendEmailSender` (único import do SDK, mapeia 4xx permanente vs transitório, `Idempotency-Key`), `logEmailSender`, variáveis no composition e no `docker-compose.yml`, falha cedo em produção sem chave. Aceite: teste do adapter mockando só o SDK; envio real de um e-mail de teste do domínio verificado (manual).
- **EM.1.3 · Base de templates.** Layout HTML/texto compartilhado, escape de variável, tokens de cor, cabeçalhos de e-mail transacional vs. não transacional. Aceite: teste de que `<script>` no nome do usuário sai escapado; pré-visualização HTML gerada em `tmp/` para o autor aprovar a aparência.
- **EM.1.4 · Webhook, supressão e domínio.** `POST /webhooks/resend` com corpo bruto, tabela `email_suppressions`, consulta de supressão no `EnqueueEmailUseCase`, e a lista de DNS (4.6) executada pelo autor. Aceite: assinatura inválida => 400; bounce permanente suprime; evento repetido é no-op. **Precede qualquer envio real a usuário.**

### Fase B, recuperação de senha (P0)

- **EM.2.1 · Tokens e casos de uso.** Tabela `auth_email_tokens`, `RequestPasswordResetUseCase`, `ResetPasswordUseCase` (revoga sessões, marca e-mail verificado, enfileira E4), port `AuthMailer`. Aceite: token de uso único, expirado recusado, anti-enumeração (mesma resposta), admin recusado (D7), conta só-Google recebe o reset normal e cria a primeira senha (D4).
- **EM.2.2 · Rotas, rate limit e docs.** `POST /auth/forgot-password`, `POST /auth/reset-password` com Zod; rate limit por IP e por e-mail; `.docs/backend/auth.md`. Aceite: 202 uniforme, 429 com `Retry-After`, supertest cobrindo cada status.
- **EM.2.3 · Telas `Esqueci minha senha` e `Redefinir senha`.** Três breakpoints, link no `Login`, atualização do inventário de telas. Aceite: fluxo ponta a ponta no `docker compose up` com `EMAIL_PROVIDER=log` e depois com Resend real.

### Fase C, verificação de e-mail e fechamento do 2.1 (P0)

- **EM.3.1 · Coluna, verificação e login bloqueado (D2).** `users.email_verified_at`; `SendEmailVerificationUseCase`/`VerifyEmailUseCase`, reenvio com teto; `RegisterUserUseCase` deixa de devolver token (responde "verifique seu e-mail"); `LoginUserUseCase` recusa conta não verificada com `403 { error: "email_not_verified" }` só depois de a senha conferir (mesmo princípio do `account_suspended`); o seed do admin e o login Google já nascem verificados; `PATCH /me` deixa de aceitar `email` (sem isso, trocar o e-mail por ali burlaria a verificação, e a D6 mantém a troca bloqueada). Aceite: testes de casos de uso; migration aplicada em base vazia (sem backfill, banco só de desenvolvimento); testes e2e em `backend/test/e2e` ajustados para registrar já verificado.
- **EM.3.2 · Vínculo Google seguro.** `GoogleProfile.emailVerified`, regra D3 em `LoginWithGoogleUseCase`, registrar 043 como ✅. Aceite: teste reproduzindo o pré-sequestro (conta local não verificada + Google) e mostrando que o atacante perde a senha.
- **EM.3.3 · Telas de verificação.** Tela `Verificar e-mail`, aviso "enviamos um link" pós-cadastro, estado do `Login` para `email_not_verified` com botão de reenviar (teto por e-mail e por IP), `AuthContext` tratando o novo `403`. Aceite: quem não verificou nunca fica sem caminho (reenviar sempre visível); fluxo ponta a ponta com `EMAIL_PROVIDER=log` e com Resend real.

### Fase D, avisos de segurança

- **EM.4.1 · Avisos E4.** Troca de senha, reset concluído, "forçar logout" pelo admin disparam o aviso. Aceite: um e-mail por evento, idempotente, sem token no corpo.

### Fase E, ciclo de vida (P1)

- **EM.5.1 · Boas-vindas, suspensão/reativação, exclusão e exportação (E5–E7, E10).** Aceite: suspensão envia motivo e como contestar; exclusão envia confirmação ao endereço **antes** da anonimização (depois ele vira `.invalid`); `.invalid` recusado por construção no `EnqueueEmailUseCase`.
- **EM.5.2 · Comunicado crítico e manutenção (E9).** Opcional por comunicado (`announcements` ganha flag `notifyByEmail`), envio em lote via outbox respeitando o limite de requisições por segundo e só a quem é verificado. Aceite: enviar para N usuários não estoura a cota nem trava o worker.

### Fase F, preferências e social (P1/P2)

- **EM.6.1 · Preferências e descadastro.** `email_preferences`, rotas `GET/PATCH /me/email-preferences` e `POST /email/unsubscribe`, `List-Unsubscribe`, tela em Configurações e página pública de descadastro, `GET /me/export` e `AnonymizeAccountUseCase` atualizados. **Precede qualquer e-mail não transacional.**
- **EM.6.2 · Pedido de amizade recebido/aceito (E8).** Teto diário por destinatário, só verificado e opt-in. Aceite: spam de pedidos não gera mais de 1 e-mail por dia por destinatário.

### Fase G, engajamento (P2, só depois da F; D8 define opt-in)

- **EM.7.1 · Resumo semanal (E12).** Job semanal lendo `ranking_snapshots`; só percentuais e nível (RNF09). **EM.7.2 · Salário mensal e conquista rara (E11, E14).** **EM.7.3 · Streak em risco como convite (E13, D9).** Job diário, só opt-in, teto de 1 e-mail por dia, não envia a quem já cumpriu a atividade do dia nem a conta suspensa. Aceite: tom sem escassez nem culpa, revisado contra `proposta-engajamento-licoes.md`.

### Fase H, operação e conformidade

- **EM.8.1 · Saúde do outbox no `AdminSistema` e retenção** (limpeza de payload/endereço após 30 dias, 4.3 e 4.12).
- **EM.8.2 · LGPD e documentação:** `PrivacidadeLgpd`/política citando o operador (Resend, transferência internacional de dados), `.docs/backend/notifications.md`, atualização de `especificacao-plataforma-investimentos.md` (RFs novos) e do inventário de telas, runbook curto de "como rotacionar a chave" e "o que fazer se o domínio entrar em lista de bloqueio".

### Sequência sugerida

`EM.1.1 → 1.2 → 1.3 → 1.4 → 2.1 → 2.2 → 2.3 → 3.1 → 3.2 → 3.3 → 4.1 → 5.1 → 6.1 → 6.2 → 5.2 → 8.1 → 8.2 → G`. Fases A–C (P0) fecham o essencial e o risco de segurança; a recuperação de senha (B) é o primeiro ganho visível. A G só começa depois de medir cancelamento e reclamação com o volume da F.

## 9. Fora de escopo (por ora)

Push notification e SMS; e-mail de marketing livre/campanhas manuais pelo admin; inbound (responder e-mail dentro do app); Universal Links/App Links; recibo de cobrança próprio (o Stripe já envia, E15 só cobre aviso de cancelamento quando `billing` existir).

## 10. Riscos

| Risco | Mitigação |
|---|---|
| Domínio cai em spam/lista de bloqueio | Subdomínios por tipo, DMARC, supressão por bounce/complaint desde a EM.1.4, nenhum e-mail de engajamento antes de medir a F. |
| Cota/limite do plano gratuito esgotada (comunicado em lote, reset em massa) | `EMAIL_SEND_RPS` configurável, teto diário por usuário, envio em lote por outbox, alerta de fila no admin (EM.8.1); subir de plano é troca de plano, não de código. |
| Token vazado por log, `Referer` ou rastreio de clique | Fragmento na URL, só hash no banco, payload limpo após envio, rastreio desligado, log mascarado. |
| Enumeração de contas por e-mail | Resposta 202 uniforme e trabalho assíncrono nos fluxos de e-mail. |
| Provedor fora do ar | Outbox com retry/backoff; nenhum fluxo de negócio depende da entrega síncrona (exceção consciente: reset fica indisponível, não inseguro). |
| Várias réplicas do backend | `SKIP LOCKED` no worker já é seguro; rate limit em memória precisa migrar pro Redis (já previsto em `rateLimit.ts`). |
| Spam por pedido de amizade usando nosso domínio | Todo usuário é verificado (D2), opt-in do destinatário, teto diário por destinatário. |
| Cadastro depende de o e-mail chegar (D2 bloqueia o login) | Reenvio sempre visível, outbox com retry, alerta de fila no admin (EM.8.1), `EMAIL_PROVIDER=log` em desenvolvimento; provedor fora do ar atrasa novos cadastros, não quem já verificou. |
