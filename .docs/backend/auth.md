# `auth` — cadastro, login e identidade

Módulo: `backend/src/modules/auth/`. Ver `.claude/arquitetura-backend-ddd-lite.md` pra entender a divisão em casos de uso — aqui é só o contrato HTTP.

---

### `POST /auth/register`

- **Autenticação:** público.
- **Payload (JSON):**
  - `name`: string, 1–100 caracteres.
  - `email`: string, formato de e-mail válido, ≤100 caracteres. Normalizado pra minúsculo.
  - `username`: string, 3–30 caracteres, só `a-z`, `0-9` e `_`. Normalizado pra minúsculo.
  - `password`: string, 8–72 caracteres (72 = limite do bcrypt; senhas maiores são rejeitadas, não truncadas em silêncio).
  - `referralCode`: string opcional (≤32), o código do link de indicação (MO.7.2, ver `referrals.md`). Formato errado, código desconhecido ou o da própria conta **nunca recusam o cadastro**: só são ignorados.
  - Qualquer outro campo enviado (ex: `role`) é **descartado** pelo schema Zod antes de chegar no caso de uso — não é possível se autopromover a admin por aqui.
- **Sucesso:** `201` → `{ user: { id, name, email, username, role, onboardingCompleted, avatarUrl }, emailVerificationRequired: true }`. **Sem `token`** (EM.3.1, D2): a conta só entra depois de verificar o e-mail.
- **Erros:**
  - `400` — payload não bate com o schema (campo faltando, e-mail inválido, senha curta, username com caractere inválido etc).
  - `409` — e-mail já cadastrado.
  - `409` — username já em uso.
  - `500` — motor de simulação indisponível ao abrir a conta (ver regra abaixo) — cai no handler de erro padrão do Express.
- **Regra:** `RegisterUserUseCase`. Faz hash da senha (bcrypt, 12 salt rounds) e cria o usuário sempre com `role: 'user'` — o caso de uso nunca aceita `role` como entrada (RNF07). `onboarding_completed` sempre nasce `false` (default da coluna, tarefa 6.0.4) — controla se o pós-login (frontend, 6.2) cai na tela de onboarding (1.2) ou direto no Portfólio (2.1). Em seguida abre a conta do usuário no motor de simulação (`POST /accounts`, ver `.docs/engine/account.md`) com o capital inicial padronizado (RNF06) — se essa chamada falhar, o cadastro inteiro falha (não fica usuário sem conta). A conta nasce com `email_verified_at` nulo e o caso de uso enfileira o e-mail de verificação (`SendEmailVerificationUseCase`); falha ao enfileirar nunca derruba o cadastro, a pessoa pede outro link por `POST /auth/resend-verification`. Não emite JWT.

---

### `POST /auth/login`

- **Autenticação:** público.
- **Payload (JSON):** `email` (formato válido), `password` (não vazio).
- **Sucesso:** `200` → `{ token, user: { id, name, email, username, role, onboardingCompleted } }`.
- **Erros:**
  - `400` — `email`/`password` ausentes ou em formato inválido.
  - `401` — credenciais inválidas: e-mail não encontrado, senha incorreta, **ou** conta criada só via Google (sem `password_hash` local) tentando logar por senha. As três situações retornam a mesma mensagem genérica, de propósito (não vazar se um e-mail existe).
  - `403` — `{ error: "email_not_verified" }`: senha correta, mas a conta criada por e-mail e senha ainda não confirmou o e-mail (EM.3.1, D2). O frontend oferece reenviar o link (`POST /auth/resend-verification`). Também só aparece depois de a senha conferir; a suspensão tem precedência. Conta criada pelo Google, admin do seed e conta que concluiu um reset de senha já são verificadas.
  - `403` — `{ error: "account_suspended" }`: senha correta, mas a conta foi suspensa pelo painel admin (N.16). Só aparece depois de a senha conferir, então quem erra a senha nunca descobre que a conta está suspensa. No login com Google o callback redireciona para `${FRONTEND_URL}/auth/callback#error=account_suspended`.
- **Regra:** `LoginUserUseCase`. O token carrega `tokenVersion` (versão de sessão da conta, N.16) e `authTime` (momento da conferência da senha) e expira em **7 dias** para `role: 'user'` e em **2 horas** para `role: 'admin'` (N.22). Login e tentativa falha de uma conta `admin` são gravados no `admin_audit_log` (`admin.login`, `admin.login_failed`).

---

### `POST /auth/reauth`

*(N.22.)* Reautenticação: confere a senha de quem já está logado e devolve um token novo com `authTime` recém-atualizado. As ações destrutivas do painel admin exigem `authTime` de até **5 minutos** (`401 { error: "reauth_required" }` quando venceu) — o frontend pede a senha, chama esta rota, troca o token e repete a ação.

- **Autenticação:** Bearer token.
- **Payload (JSON):** `password` (não vazio).
- **Sucesso:** `200` → `{ token }`.
- **Erros:**
  - `400` — `password` ausente.
  - `401` — token ausente/inválido, **ou** senha incorreta (inclusive conta sem senha local, só Google).
  - `404` — usuário do token não existe mais.
  - `429` — mais de 10 tentativas em 5 minutos pelo mesmo IP.
- **Regra:** `ReauthenticateUseCase`. Para `role: 'admin'`, grava `admin.reauth` / `admin.reauth_failed` no log de auditoria. Reautenticar não estende a expiração do token além da regra de 7 dias / 2 horas, que recomeça no token novo.

---

### `POST /auth/forgot-password`

*(EM.2.2.)* Pede o link de redefinição de senha por e-mail.

- **Autenticação:** público.
- **Payload (JSON):** `email` (formato válido, ≤100 caracteres, normalizado pra minúsculo).
- **Sucesso:** `202` → `{ message }`, **sempre a mesma resposta**, exista a conta ou não (não vaza quais e-mails têm conta).
- **Erros:**
  - `400` — `email` ausente ou em formato inválido.
  - `429` — `{ error }` com `Retry-After`: mais de 20 pedidos em 15 minutos pelo mesmo IP **ou** mais de 3 em 15 minutos para o mesmo e-mail (conta mesmo quando a conta não existe).
- **Regra:** `RequestPasswordResetUseCase`. Cria um token de 32 bytes aleatórios (só o hash SHA-256 vai ao banco, tabela `auth_email_tokens`), válido por **30 minutos** e de uso único; um pedido novo invalida o link anterior. O e-mail (`password_reset`, categoria segurança) entra no outbox e é enviado pelo worker, com o link `${FRONTEND_URL}/redefinir-senha#token=...` (token no fragmento, que não chega ao servidor nem a logs). Conta só-Google recebe o mesmo e-mail e cria a primeira senha pelo link. Conta `role = admin` **não** redefine senha por e-mail: nada é enviado e a tentativa fica no `admin_audit_log` como `admin.password_reset_denied`. Conta anonimizada (`@anonimo.invalid`) nunca recebe e-mail.

---

### `POST /auth/resend-verification`

*(EM.3.1.)* Pede um novo link de verificação de e-mail. Anula o link anterior.

- **Autenticação:** público.
- **Payload (JSON):** `email` (formato válido, ≤100 caracteres, normalizado pra minúsculo).
- **Sucesso:** `202` → `{ message }`, **sempre a mesma resposta**: exista a conta ou não, já esteja verificada ou não, esteja suspensa ou não (sem enumeração de e-mail). O e-mail só é enfileirado para conta existente, pendente e não suspensa.
- **Erros:**
  - `400` — `email` ausente ou em formato inválido.
  - `429` — teto de 20 pedidos por IP e 3 por e-mail (conta mesmo se o e-mail não existe) em 15 minutos, com `Retry-After`.
- **Regra:** `SendEmailVerificationUseCase`. Token de 32 bytes aleatórios (só o SHA-256 vai ao banco, tabela `auth_email_tokens`, `kind = email_verification`), uso único, TTL de 24 h. O link é `${FRONTEND_URL}/verificar-email#token=...` (fragmento, não vai ao servidor nem ao `Referer`) e o e-mail é da categoria `security` (não desligável).

---

### `POST /auth/verify-email`

*(EM.3.1.)* Consome o link de verificação e libera o login da conta.

- **Autenticação:** público (o token é a credencial).
- **Payload (JSON):** `token` (texto, 1–200 caracteres).
- **Sucesso:** `200` → `{ message: "e-mail verificado" }`. Não devolve sessão: depois de verificar, a pessoa entra pelo login normal.
- **Erros:**
  - `400` — `token` ausente.
  - `401` — `{ error: "invalid_token" }`: token desconhecido (ou de outro tipo, como o de reset).
  - `410` — `{ error: "token_expired" }` (passou das 24 h) ou `{ error: "token_used" }` (já usado ou substituído por um reenvio). O frontend oferece reenviar.
  - `429` — mais de 20 tentativas em 15 minutos pelo mesmo IP.
- **Regra:** `VerifyEmailUseCase`. Consumo atômico do token (dois cliques simultâneos, só um passa) e grava `users.email_verified_at`. *(EM.5.1.)* Na primeira verificação (conta que ainda não estava verificada) enfileira as boas-vindas `welcome` (E5, transacional, com botão para a trilha; chave `welcome:<userId>`, uma por conta). Link reaberto de conta já verificada não reenvia.

---

### `POST /auth/reset-password`

*(EM.2.2.)* Conclui a redefinição com o token do link.

- **Autenticação:** público (o token é a credencial).
- **Payload (JSON):** `token` (texto, 1–200 caracteres), `newPassword` (8–72 caracteres, mesma regra do cadastro).
- **Sucesso:** `200` → `{ message: "senha redefinida" }`.
- **Erros:**
  - `400` — payload fora do schema (senha curta ou longa demais, token ausente). Não consome o token.
  - `401` — `{ error: "invalid_token" }`: token desconhecido (ou de conta admin).
  - `410` — `{ error: "token_expired" }` (passou dos 30 minutos) ou `{ error: "token_used" }` (link já usado ou substituído por um pedido mais novo). O frontend oferece pedir outro link.
  - `429` — mais de 20 tentativas em 15 minutos pelo mesmo IP.
- **Regra:** `ResetPasswordUseCase`. Consome o token de forma atômica (duas requisições com o mesmo link: só uma passa), grava a senha nova, marca o e-mail como verificado (quem leu o link provou controlar a caixa), encerra **todas** as sessões abertas (`revokeSessions`, o JWT antigo passa a ser recusado) e enfileira o aviso "sua senha foi alterada" (`password_changed`, sem token no corpo). Falha ao enfileirar o aviso não desfaz a troca.

---

### `GET /auth/google`

- **Autenticação:** público.
- **Payload:** nenhum.
- **Sucesso:** `302` — redireciona pra tela de consentimento do Google, com um `state` aleatório por requisição.
- **Erros:** se `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`/`GOOGLE_REDIRECT_URI` não estiverem configurados no ambiente, o provider "desabilitado" lança erro e a requisição cai no handler de erro padrão do Express (`500`).
- **Regra:** monta a URL de autorização OAuth2 (`google-auth-library`). Sem caso de uso próprio — delegação pura, ver `.claude/arquitetura-backend-ddd-lite.md`.

---

### `GET /auth/google/callback`

- **Autenticação:** público (chamado pelo navegador, redirecionado pelo Google após consentimento).
- **Payload (query string):** `code` — string, obrigatório.
- **Sucesso:** `302` — redireciona pra `${FRONTEND_URL}/auth/callback#token=<jwt>`.
- **Erros:**
  - `400` — `code` ausente na query.
  - `302` para `${FRONTEND_URL}/auth/callback#error=google_email_not_verified` — o Google não marcou o e-mail como verificado (`email_verified` do ID token) e já existe uma conta local com esse e-mail: nada é vinculado nem alterado (EM.3.2).
  - `502` — falha ao trocar o `code` por token junto ao Google, ou payload do Google incompleto (sem `sub`/`email`).
- **Indicação (MO.7.2):** `GET /auth/google?ref=<código>` leva o código no `state` do OAuth (`<uuid>.<código>`), que o Google devolve no callback; `POST /auth/google/token` aceita `referralCode` (opcional). O código só vale quando a chamada **cria** a conta; em conta existente é ignorado.
- **Regra:** `LoginWithGoogleUseCase`. Se já existe `user_identities` pra esse `(google, sub)`, reaproveita o usuário. Senão, tenta casar por e-mail com uma conta já existente (criada via e-mail/senha) — se achar, **só vincula se o Google informou `email_verified = true`** (ponto 043). Se a conta local nunca confirmou o e-mail, ela pode ter sido aberta por outra pessoa: o vínculo **zera o `password_hash`**, encerra as sessões (`revokeSessions`) e marca o e-mail como verificado, de modo que a senha de quem cadastrou antes deixa de valer (D3); conta local já verificada vincula normal e mantém a senha. Conta suspensa é checada antes de qualquer alteração. Sem conta pra casar, cria só a identidade nova, sem duplicar o usuário. Se não achar nada, cria usuário novo com `password_hash: null` e username derivado do e-mail (com sufixo numérico se já estiver em uso) — só nesse caso (usuário novo) abre conta no motor de simulação com o capital inicial padronizado (RNF06), igual ao `POST /auth/register`. Conta nova nasce com o e-mail verificado se o Google informou `email_verified`, e nesse caso recebe as boas-vindas `welcome` (EM.5.1, uma por conta). Quem só vinculou conta já existente não recebe. Sempre `role: 'user'`.

---

### `POST /auth/google/token`

- **Autenticação:** público.
- **Payload (JSON):** `idToken` — string, obrigatório. `idToken` assinado pelo Google, obtido pelo SDK nativo (`@react-native-google-signin/google-signin`) no app mobile — **não** o `code` de redirect usado por `GET /auth/google/callback`.
- **Sucesso:** `200` → `{ token, user: { id, name, email, username, role, onboardingCompleted } }` — mesmo formato de `POST /auth/login`/`POST /auth/register`.
- **Erros:**
  - `400` — `idToken` ausente ou vazio.
  - `401` — `idToken` inválido, expirado, ou com `audience`/assinatura que não bate (a lib `google-auth-library` rejeita antes de chegar no caso de uso).
- **Regra:** `LoginWithGoogleUseCase`, mesmo caso de uso de `GET /auth/google/callback` — só muda a origem do perfil (`verifyIdToken` em vez de `exchangeCode`). Reaproveita identidade/usuário existente por `(google, sub)`, depois por e-mail, senão cria conta nova com capital inicial padronizado (RNF06), exatamente como o fluxo de redirect. **Importante:** o `audience` aceito na verificação é o client ID **Web** (`GOOGLE_CLIENT_ID`, o mesmo do fluxo de redirect) — não os client IDs Android/iOS cadastrados só pra autenticar o app nativo junto ao Google. Ver `.claude/runbook-mudanca-identidade-app-conta-google.md` seção 0 pra detalhe de por quê. Rota aditiva — `GET /auth/google`/`GET /auth/google/callback` não mudam.

---

### `GET /auth/me`

- **Autenticação:** Bearer token (qualquer usuário autenticado).
- **Payload:** nenhum.
- **Sucesso:** `200` → `{ user: { id, name, email, username, role, onboardingCompleted, avatarUrl } }`.
- **Erros:**
  - `401` — token ausente ou inválido/expirado.
  - `404` — token válido mas o usuário não existe mais (ex: deletado).
- **Regra:** `GetCurrentUserUseCase`. `onboardingCompleted` (tarefa 6.0.4, tela 1.2) é o que o frontend usa pra decidir entre onboarding e Portfólio pós-login — nunca um flag local (localStorage), que não sobreviveria a um segundo dispositivo/navegador. `avatarUrl` (tarefa 6.10.8) é a URL pública já resolvida (`/avatars/<arquivo>`, ver `POST /me/avatar` abaixo) — `null` até o primeiro upload; `userSerializer.ts` monta essa URL a partir de `users.avatar_path`, nunca expõe o caminho cru.

---

## Configurações de conta e LGPD (tarefa 5.11, RNF04, telas 9.2–9.3)

`interfaces/http/accountRouter.ts` — router separado de `authRouter.ts` só por organização (mesmo módulo `auth`, mesmo precedente de `modules/admin` com `pingRouter.ts` + `adminMacroEventsRouter.ts`).

### `PATCH /me`

- **Autenticação:** Bearer token.
- **Payload (JSON):** `name?`, `username?`, `onboardingCompleted?` (boolean, tarefa 6.0.4) — mesmas regras de formato do cadastro pros dois primeiros; pelo menos um campo obrigatório. **`email` não é aceito** (EM.3.1, D6): trocar o e-mail por aqui burlaria a verificação, então o campo é descartado pelo schema (e um corpo só com `email` cai no `400`).
- **Sucesso:** `200` → `{ user: { id, name, email, username, role, onboardingCompleted, avatarUrl } }`.
- **Erros:**
  - `400` — payload inválido ou nenhum campo enviado.
  - `401` — token ausente ou inválido/expirado.
  - `409` — username já em uso por **outro** usuário (reenviar o próprio username atual é permitido, não conflita consigo mesmo).
- **Regra:** `UpdateProfileUseCase`. Checa conflito de username antes de persistir — a `UNIQUE` do banco é a garantia final, mas o caso de uso devolve um erro de negócio claro em vez de deixar o Postgres estourar a constraint crua. `onboardingCompleted` não passa por essa checagem de conflito (não é um campo único) — é um campo de perfil como outro qualquer, sem endpoint dedicado (decisão da tarefa 6.0.4: não justifica rota própria).

---

### `POST /me/password`

- **Autenticação:** Bearer token.
- **Payload (JSON):** `currentPassword?` (obrigatória só se a conta já tem senha local), `newPassword` — 8–72 caracteres.
- **Sucesso:** `200` → `{ status: 'senha atualizada' }`.
- **Erros:**
  - `400` — payload inválido.
  - `401` — token ausente ou inválido/expirado (sessão, não a senha atual).
  - `403` — `currentPassword` ausente numa conta com senha local, ou `currentPassword` incorreta (as duas não trocam nada). **Nunca `401`** — decisão da tarefa 6.10 (frontend, tela 9.2): o client HTTP trata todo `401` de endpoint autenticado como sessão inválida e desloga o usuário (`services/client`) — um `401` aqui deslogaria só por errar a senha atual digitada.
- **Regra:** `ChangePasswordUseCase`. Conta só-OAuth (`password_hash IS NULL`) pode setar a primeira senha sem informar `currentPassword` — passa a ter os dois métodos de login disponíveis dali em diante, sem tirar o OAuth. *(EM.4.1.)* Depois de gravar a senha, enfileira o aviso `password_changed` (E4) para o e-mail da conta, um por troca, sem token no corpo e com o texto sem afirmar que outras sessões foram encerradas (esta rota não as revoga). Falha ao enfileirar o aviso é só logada e não desfaz a troca.

---

### `GET /me/identities`

- **Autenticação:** Bearer token.
- **Payload:** nenhum.
- **Sucesso:** `200` → `{ identities: [{ id, userId, providerName, providerAccountId }] }`. Nunca inclui `accessToken`/`refreshToken` — a query no repositório seleciona só essas 4 colunas, a blindagem é estrutural, não um campo omitido depois.
- **Erros:** `401` — token ausente ou inválido/expirado.
- **Regra:** `ListIdentitiesUseCase`.

---

### `GET /me/export`

- **Autenticação:** Bearer token.
- **Payload:** nenhum.
- **Sucesso:** `200` → `{ export: { user, identities, progression, lessonProgress, achievements, friendships, missionProgress, emailPreferences } }`. Portabilidade (RNF04) — agrega em JSON os dados do próprio usuário nas tabelas que o backend já possui: `users` (sem `password_hash`), `user_identities` (sem tokens), `user_lesson_progress`, `user_achievements`, `user_progression`, `friendships`, `user_mission_progress`, `email_preferences` (EM.6.1, `{ social, engagement }`, tudo `false` se nunca mexeu). **Dados financeiros (saldo/posições/extrato, banco `market`) ficam fora desta tarefa** — exigiria uma nova chamada ao motor sem nenhum critério de aceite pedindo isso explicitamente; decisão de escopo a revisitar se a intenção pedagógica exigir o extrato completo.
- **Erros:** `401` — token ausente ou inválido/expirado.
- **Regra:** `ExportUserDataUseCase`, agregando em processo 5 ports próprias e mínimas (mesmo padrão de composição do resto da semana) sobre `gamification`/`lessons`/`achievements`/`friendships`/`missions` — cada módulo produtor ganhou uma tiny "export use case" nova, reaproveitando repositórios já existentes (só `missions` ganhou um método novo no repositório, `listAllProgressForUser`, porque nenhum caso de uso existente devolvia o histórico completo, só o dia corrente). *(EM.5.1.)* Cada exportação enfileira o aviso `data_exported` (E7, transacional) para o e-mail da conta, um por exportação, como alerta para quem não a pediu; falha ao enfileirar só é logada e não impede a exportação.

---

### `DELETE /me`

- **Autenticação:** Bearer token.
- **Payload:** nenhum.
- **Sucesso:** `204`, sem corpo.
- **Erros:** `401` — token ausente ou inválido/expirado.
- **Regra:** `AnonymizeAccountUseCase`. **Nunca é um `DELETE` físico da linha de `users`** — decisão de modelagem desta sessão, não confirmada explicitamente: `market_events`/`positions`/`macro_events` (motor) e as tabelas de gamificação guardam `user_id` como referência a um histórico imutável (Event Sourcing, CLAUDE.md) que não pode perder a FK. Em vez disso, anonimiza (`name` → "Usuário removido", `email`/`username` → valores sintéticos únicos derivados do próprio `id`, `password_hash` → `NULL`) mantendo a linha e o `id` intactos, e remove todas as linhas de `user_identities` — o rastro financeiro/gamificado continua existindo (histórico de mercado, ranking passado), só a identidade pessoal some. Usuário anonimizado não consegue mais logar (sem senha local, sem OAuth). *(EM.5.1.)* **Antes** de anonimizar, enfileira a confirmação `account_deleted` (E7, segurança, sem dado pessoal no payload) ao endereço real; o outbox guarda o endereço de entrega, então o e-mail sai mesmo depois de a conta virar `@anonimo.invalid`. Falha ao enfileirar só é logada e nunca impede a exclusão (LGPD). Conta já anonimizada não recebe nada (`.invalid` é recusado por construção). Vale também para a exclusão feita pelo admin. *(EM.6.1.)* Depois de anonimizar, apaga também as preferências de e-mail e as linhas do outbox do usuário (menos a confirmação de exclusão, que ainda precisa sair); ver `.docs/backend/notifications.md`.

---

### `POST /me/avatar`

- **Autenticação:** Bearer token.
- **Payload:** `multipart/form-data`, campo `avatar` (arquivo único) — `image/jpeg`, `image/png` ou `image/webp`, até 5MB.
- **Sucesso:** `200` → `{ user: { id, name, email, username, role, onboardingCompleted, avatarUrl } }` — mesmo formato de `PATCH /me`.
- **Erros:**
  - `400` — nenhum arquivo enviado, tipo fora da lista permitida, ou arquivo maior que 5MB (multer corta a conexão antes do handler nesse último caso — ver nota abaixo).
  - `401` — token ausente ou inválido/expirado.
  - `404` — token válido mas o usuário não existe mais.
- **Regra:** `UploadAvatarUseCase`. Arquivo salvo em disco (volume Docker persistente `avatar_data`, `AVATAR_STORAGE_DIR`/`diskAvatarStorage.ts`) — só o nome do arquivo em `users.avatar_path`, nunca base64 numa coluna. Tipo/tamanho validados no use case (regra de negócio, testável sem Express), não só no `multer` do router (`avatarUpload`, `limits.fileSize`) — defesa em profundidade. Ao trocar de foto, o arquivo anterior é apagado só depois do novo caminho já estar persistido no banco (nunca fica sem avatar nenhum se a escrita falhar no meio). Servido de volta em `GET /avatars/<arquivo>` (`express.static`, montado na composição de `app.ts`) — sem rota de download dedicada, o navegador já resolve `<img src>` direto.
- **Nota:** o backend não tem um handler de erro HTTP central (`app.ts` não registra um middleware de 4 argumentos) — um arquivo maior que o limite do `multer` propaga um erro não capturado que cai no handler default do Express (resposta HTML, não JSON), mesmo comportamento de qualquer `throw` não tratado nas demais rotas do módulo. Não é regressão desta tarefa, é o padrão já existente em todo o backend.


---

## Suspensão e sessão (tarefa N.16)

Toda rota autenticada passa pelo `authMiddleware`, que depois de validar a assinatura consulta o usuário (uma leitura por chave primária, sem cache de propósito): conta suspensa recebe `403 { error: "account_suspended" }` e token com `tokenVersion` diferente do atual da conta recebe `401 { error: "sessão encerrada" }`. É isso que dá efeito imediato a "suspender" e "forçar logout" num JWT stateless. Token emitido antes da N.16 não tem o claim e vale como versão 0, a versão inicial de toda conta, então ninguém é deslogado pela migração. `DELETE /me` também revoga as sessões. O frontend trata os dois erros como fim de sessão. Gestão pelo painel: `.docs/backend/admin.md`.
