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
- **Regra:** `RegisterUserUseCase`. Faz hash da senha (bcrypt, 12 salt rounds) e cria o usuário sempre com `role: 'user'` — o caso de uso nunca aceita `role` como entrada (RNF07). Emite JWT válido por 7 dias assinado com `{ sub: userId, role }`.

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
- **Regra:** `LoginWithGoogleUseCase`. Se já existe `user_identities` pra esse `(google, sub)`, reaproveita o usuário. Senão, tenta casar por e-mail com uma conta já existente (criada via e-mail/senha) — se achar, só cria a identidade nova, sem duplicar o usuário. Se não achar nada, cria usuário novo com `password_hash: null` e username derivado do e-mail (com sufixo numérico se já estiver em uso). Sempre `role: 'user'`.

---

### `GET /auth/me`

- **Autenticação:** Bearer token (qualquer usuário autenticado).
- **Payload:** nenhum.
- **Sucesso:** `200` → `{ user: { id, name, email, username, role } }`.
- **Erros:**
  - `401` — token ausente ou inválido/expirado.
  - `404` — token válido mas o usuário não existe mais (ex: deletado).
- **Regra:** `GetCurrentUserUseCase`.
