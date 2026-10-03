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
  - Qualquer outro campo enviado (ex: `role`) é **descartado** pelo schema Zod antes de chegar no caso de uso — não é possível se autopromover a admin por aqui.
- **Sucesso:** `201` → `{ token, user: { id, name, email, username, role, onboardingCompleted } }`.
- **Erros:**
  - `400` — payload não bate com o schema (campo faltando, e-mail inválido, senha curta, username com caractere inválido etc).
  - `409` — e-mail já cadastrado.
  - `409` — username já em uso.
  - `500` — motor de simulação indisponível ao abrir a conta (ver regra abaixo) — cai no handler de erro padrão do Express.
- **Regra:** `RegisterUserUseCase`. Faz hash da senha (bcrypt, 12 salt rounds) e cria o usuário sempre com `role: 'user'` — o caso de uso nunca aceita `role` como entrada (RNF07). `onboarding_completed` sempre nasce `false` (default da coluna, tarefa 6.0.4) — controla se o pós-login (frontend, 6.2) cai na tela de onboarding (1.2) ou direto no Portfólio (2.1). Em seguida abre a conta do usuário no motor de simulação (`POST /accounts`, ver `.docs/engine/account.md`) com o capital inicial padronizado (RNF06) — se essa chamada falhar, o cadastro inteiro falha (não fica usuário sem conta). Emite JWT válido por 7 dias assinado com `{ sub: userId, role }`.

---

### `POST /auth/login`

- **Autenticação:** público.
- **Payload (JSON):** `email` (formato válido), `password` (não vazio).
- **Sucesso:** `200` → `{ token, user: { id, name, email, username, role, onboardingCompleted } }`.
- **Erros:**
  - `400` — `email`/`password` ausentes ou em formato inválido.
  - `401` — credenciais inválidas: e-mail não encontrado, senha incorreta, **ou** conta criada só via Google (sem `password_hash` local) tentando logar por senha. As três situações retornam a mesma mensagem genérica, de propósito (não vazar se um e-mail existe).
- **Regra:** `LoginUserUseCase`. O token carrega `authTime` (momento da conferência da senha) e expira em **7 dias** para `role: 'user'` e em **2 horas** para `role: 'admin'` (N.22). Login e tentativa falha de uma conta `admin` são gravados no `admin_audit_log` (`admin.login`, `admin.login_failed`).

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
  - `502` — falha ao trocar o `code` por token junto ao Google, ou payload do Google incompleto (sem `sub`/`email`).
- **Regra:** `LoginWithGoogleUseCase`. Se já existe `user_identities` pra esse `(google, sub)`, reaproveita o usuário. Senão, tenta casar por e-mail com uma conta já existente (criada via e-mail/senha) — se achar, só cria a identidade nova, sem duplicar o usuário. Se não achar nada, cria usuário novo com `password_hash: null` e username derivado do e-mail (com sufixo numérico se já estiver em uso) — só nesse caso (usuário novo) abre conta no motor de simulação com o capital inicial padronizado (RNF06), igual ao `POST /auth/register`. Sempre `role: 'user'`.

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
- **Payload (JSON):** `name?`, `email?`, `username?`, `onboardingCompleted?` (boolean, tarefa 6.0.4) — mesmas regras de formato do cadastro pros três primeiros; pelo menos um campo obrigatório.
- **Sucesso:** `200` → `{ user: { id, name, email, username, role, onboardingCompleted, avatarUrl } }`.
- **Erros:**
  - `400` — payload inválido ou nenhum campo enviado.
  - `401` — token ausente ou inválido/expirado.
  - `409` — e-mail ou username já em uso por **outro** usuário (reenviar o próprio e-mail/username atual é permitido, não conflita consigo mesmo).
- **Regra:** `UpdateProfileUseCase`. Checa conflito antes de persistir — a `UNIQUE` do banco é a garantia final, mas o caso de uso devolve um erro de negócio claro em vez de deixar o Postgres estourar a constraint crua. `onboardingCompleted` não passa por essa checagem de conflito (não é um campo único) — é um campo de perfil como outro qualquer, sem endpoint dedicado (decisão da tarefa 6.0.4: não justifica rota própria).

---

### `POST /me/password`

- **Autenticação:** Bearer token.
- **Payload (JSON):** `currentPassword?` (obrigatória só se a conta já tem senha local), `newPassword` — 8–72 caracteres.
- **Sucesso:** `200` → `{ status: 'senha atualizada' }`.
- **Erros:**
  - `400` — payload inválido.
  - `401` — token ausente ou inválido/expirado (sessão, não a senha atual).
  - `403` — `currentPassword` ausente numa conta com senha local, ou `currentPassword` incorreta (as duas não trocam nada). **Nunca `401`** — decisão da tarefa 6.10 (frontend, tela 9.2): o client HTTP trata todo `401` de endpoint autenticado como sessão inválida e desloga o usuário (`services/client`) — um `401` aqui deslogaria só por errar a senha atual digitada.
- **Regra:** `ChangePasswordUseCase`. Conta só-OAuth (`password_hash IS NULL`) pode setar a primeira senha sem informar `currentPassword` — passa a ter os dois métodos de login disponíveis dali em diante, sem tirar o OAuth.

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
- **Sucesso:** `200` → `{ export: { user, identities, progression, lessonProgress, achievements, friendships, missionProgress } }`. Portabilidade (RNF04) — agrega em JSON os dados do próprio usuário nas tabelas que o backend já possui: `users` (sem `password_hash`), `user_identities` (sem tokens), `user_lesson_progress`, `user_achievements`, `user_progression`, `friendships`, `user_mission_progress`. **Dados financeiros (saldo/posições/extrato, banco `market`) ficam fora desta tarefa** — exigiria uma nova chamada ao motor sem nenhum critério de aceite pedindo isso explicitamente; decisão de escopo a revisitar se a intenção pedagógica exigir o extrato completo.
- **Erros:** `401` — token ausente ou inválido/expirado.
- **Regra:** `ExportUserDataUseCase`, agregando em processo 5 ports próprias e mínimas (mesmo padrão de composição do resto da semana) sobre `gamification`/`lessons`/`achievements`/`friendships`/`missions` — cada módulo produtor ganhou uma tiny "export use case" nova, reaproveitando repositórios já existentes (só `missions` ganhou um método novo no repositório, `listAllProgressForUser`, porque nenhum caso de uso existente devolvia o histórico completo, só o dia corrente).

---

### `DELETE /me`

- **Autenticação:** Bearer token.
- **Payload:** nenhum.
- **Sucesso:** `204`, sem corpo.
- **Erros:** `401` — token ausente ou inválido/expirado.
- **Regra:** `AnonymizeAccountUseCase`. **Nunca é um `DELETE` físico da linha de `users`** — decisão de modelagem desta sessão, não confirmada explicitamente: `market_events`/`positions`/`macro_events` (motor) e as tabelas de gamificação guardam `user_id` como referência a um histórico imutável (Event Sourcing, CLAUDE.md) que não pode perder a FK. Em vez disso, anonimiza (`name` → "Usuário removido", `email`/`username` → valores sintéticos únicos derivados do próprio `id`, `password_hash` → `NULL`) mantendo a linha e o `id` intactos, e remove todas as linhas de `user_identities` — o rastro financeiro/gamificado continua existindo (histórico de mercado, ranking passado), só a identidade pessoal some. Usuário anonimizado não consegue mais logar (sem senha local, sem OAuth).

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
