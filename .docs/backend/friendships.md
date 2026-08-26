# `friendships` — sistema de amizade (RF18)

Módulo: `backend/src/modules/friendships/`. Sobre a tabela `friendships` (já existente desde 1.3, com `UNIQUE(requester_id, addressee_id)` e `CHECK` contra auto-amizade). Amizade é bilateral com aceite — nunca criada direto como `accepted` a partir de uma única solicitação (exceto pedido mútuo, ver abaixo). Sem bloqueio de usuário nesta fase (deferido pra Fase 2, spec 8.1). Todo usuário é público e buscável — não há perfil privado nesta fase (CLAUDE.md).

`UserDirectory` própria do módulo (leitura direta de `users`, mesmo banco `gamification`, não é chamada entre serviços) — mesmo padrão de `modules/ranking` (5.5), port por módulo em vez de uma compartilhada.

---

### `GET /users/search`

- **Autenticação:** Bearer token.
- **Payload (query):** `q` — string, mínimo 1 caractere.
- **Sucesso:** `200` → `{ users: [{ id, username, name }] }`. Busca por `username` (`ILIKE %q%`), exclui o próprio usuário. Limite de 20 resultados.
- **Erros:**
  - `400` — `q` ausente ou vazio.
  - `401` — token ausente ou inválido/expirado.
- **Regra:** `SearchUsersUseCase`.

---

### `POST /friendships`

- **Autenticação:** Bearer token.
- **Payload (JSON):** `addresseeUsername` — string.
- **Sucesso:** `201` → `{ friendship: { id, requesterId, addresseeId, status, createdAt, respondedAt } }`.
- **Erros:**
  - `400` — payload inválido, ou auto-solicitação (`addresseeUsername` é o próprio usuário).
  - `401` — token ausente ou inválido/expirado.
  - `404` — `addresseeUsername` não corresponde a nenhum usuário.
  - `409` — solicitação já existe na mesma direção, ou os dois já são amigos.
- **Regra:** `SendFriendRequestUseCase`. Decisão de escopo desta sessão, não confirmada explicitamente: se o destinatário já tinha enviado uma solicitação na direção oposta (pedido mútuo), a nova solicitação aceita automaticamente a existente (`status: accepted` na resposta) em vez de criar uma segunda linha — sinalizar se a intenção for sempre exigir uma ação explícita de aceite mesmo nesse caso.

---

### `POST /friendships/:id/accept`

- **Autenticação:** Bearer token.
- **Payload:** nenhum.
- **Sucesso:** `200` → `{ friendship: { ...status: 'accepted', respondedAt preenchido } }`. Idempotente — aceitar duas vezes não falha, só confirma o estado.
- **Erros:**
  - `401` — token ausente ou inválido/expirado.
  - `403` — quem chama não é o `addressee` da solicitação.
  - `404` — solicitação inexistente.
- **Regra:** `RespondToFriendRequestUseCase`.

---

### `DELETE /friendships/:id`

- **Autenticação:** Bearer token.
- **Payload:** nenhum.
- **Sucesso:** `204`, sem corpo.
- **Erros:**
  - `401` — token ausente ou inválido/expirado.
  - `403` — quem chama não é o `requester` nem o `addressee` da solicitação.
  - `404` — solicitação inexistente.
  - `409` — solicitação já não está `pending` (ex: já aceita — esta rota não desfaz amizade, "remover amigo" não está no escopo desta tarefa).
- **Regra:** `RemoveFriendshipUseCase`. Cobre tanto recusar (spec 8.4, quando quem chama é o `addressee`) quanto cancelar (quando quem chama é o `requester`) — decisão de escopo desta sessão, não confirmada explicitamente: as duas ações são, na prática, a mesma operação de domínio (remover uma solicitação pendente); a rota é única e a autorização decide dentro do caso de uso qual dos dois é válido pra quem chama, em vez de duas rotas separadas.

---

### `GET /friendships`

- **Autenticação:** Bearer token.
- **Payload:** nenhum.
- **Sucesso:** `200` → `{ friends: [{ userId, username, name, friendsSince }] }` — só amizades `accepted`, dos dois lados da relação (`requester` ou `addressee`).
- **Erros:** `401` — token ausente ou inválido/expirado.
- **Regra:** `ListFriendsUseCase`.

---

### `GET /friendships/requests`

- **Autenticação:** Bearer token.
- **Payload:** nenhum.
- **Sucesso:** `200` → `{ received: [{ friendshipId, userId, username, name, createdAt }], sent: [...] }` — solicitações pendentes recebidas e enviadas, separadas.
- **Erros:** `401` — token ausente ou inválido/expirado.
- **Regra:** `ListFriendRequestsUseCase`.

---

## Verificação cruzada pra outros módulos (sem endpoint HTTP próprio)

`ExportFriendshipsUseCase.execute({ userId })` (tarefa 5.11, portabilidade RNF04) — junta `listAccepted`/`listReceivedPending`/`listSentPending` (linhas cruas de `friendships`, não o formato de UI de `ListFriendsUseCase`), nenhum método novo no repositório. Consumida em processo por `modules/auth` via port própria (`FriendshipsExporter`).
