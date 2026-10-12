# `friendships` — sistema de amizade (RF18)

Módulo: `backend/src/modules/friendships/`. Sobre a tabela `friendships` (já existente desde 1.3, com `UNIQUE(requester_id, addressee_id)` e `CHECK` contra auto-amizade). Amizade é bilateral com aceite — nunca criada direto como `accepted` a partir de uma única solicitação (exceto pedido mútuo, ver abaixo). Sem bloqueio de usuário nesta fase (deferido pra Fase 2, spec 8.1). Todo usuário é público e buscável — não há perfil privado nesta fase (CLAUDE.md).

`UserDirectory` própria do módulo (leitura direta de `users`, mesmo banco `gamification`, não é chamada entre serviços) — mesmo padrão de `modules/ranking` (5.5), port por módulo em vez de uma compartilhada.

---

### `GET /users/search`

- **Autenticação:** Bearer token.
- **Payload (query):** `q` — string, mínimo 1 caractere.
- **Sucesso:** `200` → `{ users: [{ id, username, name, avatarUrl, cosmetics }] }`. Busca por `username` (`ILIKE %q%`), exclui o próprio usuário. Limite de 20 resultados.
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
- **Regra:** `SendFriendRequestUseCase`. Decisão de escopo desta sessão, não confirmada explicitamente: se o destinatário já tinha enviado uma solicitação na direção oposta (pedido mútuo), a nova solicitação aceita automaticamente a existente (`status: accepted` na resposta) em vez de criar uma segunda linha — sinalizar se a intenção for sempre exigir uma ação explícita de aceite mesmo nesse caso. *(EM.6.2.)* **Aviso por e-mail:** depois de gravar, enfileira `friend_request_received` para o destinatário (no pedido mútuo, o aviso é de aceite e vai para quem pediu primeiro). É e-mail **social, opt-in** (`GET/PATCH /me/email-preferences`, desligado por padrão): só sai com "Amigos" ligado, e-mail verificado e conta ativa. O corpo leva só username, nível e rentabilidade percentual da semana de quem pediu (RNF09: nunca patrimônio). **Teto de 1 e-mail social por destinatário por dia** (dia de Brasília, pela chave de idempotência `social-daily:<destinatário>:<dia>`, que vale para pedidos e aceites juntos): o resto do dia o pedido só aparece na tela de solicitações. Falha ao enfileirar só é logada e nunca desfaz o pedido.

---

### `POST /friendships/:id/accept`

- **Autenticação:** Bearer token.
- **Payload:** nenhum.
- **Sucesso:** `200` → `{ friendship: { ...status: 'accepted', respondedAt preenchido } }`. Idempotente — aceitar duas vezes não falha, só confirma o estado.
- **Erros:**
  - `401` — token ausente ou inválido/expirado.
  - `403` — quem chama não é o `addressee` da solicitação.
  - `404` — solicitação inexistente.
- **Regra:** `RespondToFriendRequestUseCase`. *(EM.6.2.)* Ao aceitar (a primeira vez; repetir é idempotente e não reenvia), enfileira `friend_request_accepted` para quem pediu, com as mesmas regras de opt-in, conteúdo e teto diário do `POST /friendships`.

---

### `DELETE /friendships/:id`

- **Autenticação:** Bearer token.
- **Payload:** nenhum.
- **Sucesso:** `204`, sem corpo.
- **Erros:**
  - `401` — token ausente ou inválido/expirado.
  - `403` — quem chama não é o `requester` nem o `addressee` da solicitação.
  - `404` — solicitação inexistente.
- **Regra:** `RemoveFriendshipUseCase`. Cobre recusar (spec 8.4, quando quem chama é o `addressee`), cancelar (quando quem chama é o `requester`) e, desde a tarefa 6.9.3, desfazer uma amizade já `accepted` (reabre a decisão de escopo original da 5.8, que deixava isso de fora) — as três ações são, na prática, a mesma operação de domínio (remover a linha de amizade entre as duas pessoas); a rota é única e independe do `status` atual, só a autorização (`isRequester || isAddressee`) é checada.

---

### `GET /friendships`

- **Autenticação:** Bearer token.
- **Payload (query):** `page` — inteiro ≥ 1, opcional, default `1`. `sort` — `asc`\|`desc`, opcional, default `desc` (mais recente primeiro).
- **Sucesso:** `200` → `{ friends: [{ friendshipId, userId, username, name, friendsSince, cosmetics }], page, pageSize, totalEntries, totalPages }` — só amizades `accepted`, dos dois lados da relação (`requester` ou `addressee`), ordenadas por `friendsSince`. `friendshipId` (exposto desde 6.9.3) é o id a passar pra `DELETE /friendships/:id` ao desfazer a amizade. `pageSize` fixo em 20 (`FRIENDS_PAGE_SIZE`, não é parâmetro de query). Página fora de `[1, totalPages]` é clampada, nunca `400` (mesmo critério da Classificação, 6.8.2).
- **Erros:**
  - `400` — `page`/`sort` inválidos.
  - `401` — token ausente ou inválido/expirado.
- **Regra:** `ListFriendsUseCase` (paginação/ordenação adicionadas na 6.9.1).

---

### `GET /friendships/requests`

- **Autenticação:** Bearer token.
- **Payload (query):** `receivedPage`/`sentPage` — inteiro ≥ 1, opcionais, default `1` cada (paginação independente pras duas listas, já que a tela mostra as duas ao mesmo tempo). `sort` — `asc`\|`desc`, opcional, default `desc`, aplica às duas listas (por `createdAt`).
- **Sucesso:** `200` → `{ received: { items: [{ friendshipId, userId, username, name, createdAt, cosmetics }], page, pageSize, totalEntries, totalPages }, sent: { ...mesmo formato } }` — solicitações pendentes recebidas e enviadas, cada uma paginada/ordenada de forma independente. `pageSize` fixo em 20, mesma constante de `GET /friendships`.
- **Erros:**
  - `400` — `receivedPage`/`sentPage`/`sort` inválidos.
  - `401` — token ausente ou inválido/expirado.
- **Regra:** `ListFriendRequestsUseCase` (paginação/ordenação adicionadas na 6.9.1).

---

## Verificação cruzada pra outros módulos (sem endpoint HTTP próprio)

`ExportFriendshipsUseCase.execute({ userId })` (tarefa 5.11, portabilidade RNF04) — junta `listAccepted`/`listReceivedPending`/`listSentPending` (linhas cruas de `friendships`, não o formato de UI de `ListFriendsUseCase`), nenhum método novo no repositório. Consumida em processo por `modules/auth` via port própria (`FriendshipsExporter`).


## Cosméticos nas listas (MO.5.1)

A busca (`GET /users/search`), a lista de amigos e as solicitações trazem `cosmetics: { isPro, frame, title }` em cada pessoa (ver `cosmetics.md`): só apresentação, vazio para quem não é PRO.
