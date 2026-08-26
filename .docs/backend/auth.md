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
- **Sucesso:** `201` → `{ token, user: { id, name, email, username, role } }`.
- **Erros:**
  - `400` — payload não bate com o schema (campo faltando, e-mail inválido, senha curta, username com caractere inválido etc).
  - `409` — e-mail já cadastrado.
  - `409` — username já em uso.
  - `500` — motor de simulação indisponível ao abrir a conta (ver regra abaixo) — cai no handler de erro padrão do Express.
- **Regra:** `RegisterUserUseCase`. Faz hash da senha (bcrypt, 12 salt rounds) e cria o usuário sempre com `role: 'user'` — o caso de uso nunca aceita `role` como entrada (RNF07). Em seguida abre a conta do usuário no motor de simulação (`POST /accounts`, ver `.docs/engine/account.md`) com o capital inicial padronizado (RNF06) — se essa chamada falhar, o cadastro inteiro falha (não fica usuário sem conta). Emite JWT válido por 7 dias assinado com `{ sub: userId, role }`.

---

### `POST /auth/login`

- **Autenticação:** público.
- **Payload (JSON):** `email` (formato válido), `password` (não vazio).
- **Sucesso:** `200` → `{ token, user: { id, name, email, username, role } }`.
- **Erros:**
  - `400` — `email`/`password` ausentes ou em formato inválido.
  - `401` — credenciais inválidas: e-mail não encontrado, senha incorreta, **ou** conta criada só via Google (sem `password_hash` local) tentando logar por senha. As três situações retornam a mesma mensagem genérica, de propósito (não vazar se um e-mail existe).
- **Regra:** `LoginUserUseCase`.

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
- **Sucesso:** `200` → `{ user: { id, name, email, username, role } }`.
- **Erros:**
  - `401` — token ausente ou inválido/expirado.
  - `404` — token válido mas o usuário não existe mais (ex: deletado).
- **Regra:** `GetCurrentUserUseCase`.

---

## Configurações de conta e LGPD (tarefa 5.11, RNF04, telas 9.2–9.3)

`interfaces/http/accountRouter.ts` — router separado de `authRouter.ts` só por organização (mesmo módulo `auth`, mesmo precedente de `modules/admin` com `pingRouter.ts` + `adminMacroEventsRouter.ts`).

### `PATCH /me`

- **Autenticação:** Bearer token.
- **Payload (JSON):** `name?`, `email?`, `username?` — mesmas regras de formato do cadastro; pelo menos um campo obrigatório.
- **Sucesso:** `200` → `{ user: { id, name, email, username, role } }`.
- **Erros:**
  - `400` — payload inválido ou nenhum campo enviado.
  - `401` — token ausente ou inválido/expirado.
  - `409` — e-mail ou username já em uso por **outro** usuário (reenviar o próprio e-mail/username atual é permitido, não conflita consigo mesmo).
- **Regra:** `UpdateProfileUseCase`. Checa conflito antes de persistir — a `UNIQUE` do banco é a garantia final, mas o caso de uso devolve um erro de negócio claro em vez de deixar o Postgres estourar a constraint crua.

---

### `POST /me/password`

- **Autenticação:** Bearer token.
- **Payload (JSON):** `currentPassword?` (obrigatória só se a conta já tem senha local), `newPassword` — 8–72 caracteres.
- **Sucesso:** `200` → `{ status: 'senha atualizada' }`.
- **Erros:**
  - `400` — payload inválido.
  - `401` — token ausente/inválido, `currentPassword` ausente numa conta com senha local, ou `currentPassword` incorreta (as duas últimas não trocam nada).
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
