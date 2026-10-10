# `socialfeed` — feed social de aprendizado

Módulo: `backend/src/modules/socialfeed/`. Backlog engajamento G.1 (Impulso 5). Tabela nova `social_feed_events` (`id`, `user_id`, `type`, `track_number`, `occurred_at`) — não existia nenhum feed de atividade antes desta tarefa (`Amigos`/`BuscarAmigos` são hub/busca, sem lista de eventos).

`type` é texto livre no schema (não `pgEnum`), de propósito — só `'track_completed'` é emitido hoje, mas um tipo futuro (ex: sequência de streak) não exige migration nova, só um `case` a mais em quem lê. `track_number` é nullable pelo mesmo motivo: um tipo futuro pode não ter trilha associada.

**RNF09 nunca é reaberta aqui:** o evento carrega só o fato "usuário X completou a trilha N" — nenhum campo de patrimônio, rentabilidade ou XP absoluto entra na tabela nem na resposta HTTP (testado explicitamente nos casos de uso).

---

### `GET /social-feed`

- **Autenticação:** Bearer token.
- **Payload:** nenhum.
- **Sucesso:** `200` → `{ events: [{ type, trackNumber, occurredAt, userId, username, name, avatarUrl, cosmetics }] }`, onde `cosmetics` é `{ isPro, frame, title }` do amigo (MO.5.1, ver `cosmetics.md`), mais recentes primeiro, limitado às últimas 20 entradas (`SOCIAL_FEED_LIMIT`) entre os amigos aceitos do usuário autenticado. `trackNumber` é só o número (`0`–`3`) — nome/cor da trilha é constante estática no frontend (mesma decisão da F.3, `.claude/backlog-engajamento-gamificacao.md`), a API não devolve `trackName`.
- **Erros:** `401` — token ausente ou inválido/expirado.
- **Regra:** `ListFeedForUserUseCase`. Sem amigo aceito → `[]` (nunca consulta eventos de estranhos: o grafo de amigos é resolvido antes de qualquer leitura de evento). Eventos de um usuário que deixou de ser amigo nunca aparecem, porque a leitura é sempre pelo grafo atual, não por um histórico de amizade.
- **Regra de escrita:** não é uma rota própria — `RecordTrackCompletedUseCase` é chamado em processo por `modules/lessons` (`AdvanceLessonUseCase`) no exato momento em que a última lição pendente de uma trilha é concluída. Ver `.docs/backend/lessons.md`.

---

## Verificação cruzada pra outros módulos (sem endpoint HTTP próprio)

`RecordTrackCompletedUseCase.execute({ userId, trackNumber })` — consumida em processo por `modules/lessons` via port própria de `lessons` (`SocialFeedRecorder`), implementada aqui do lado de fora (`lessons/infrastructure/socialfeed/inProcessSocialFeedRecorder.ts`) — direção invertida do padrão usual (`missions`/`market`/`profile` consomem `lessons`; aqui é `lessons` quem consome `socialfeed`).

Leitura do grafo de amigos aceitos reaproveita `modules/friendships`' `FriendshipRepository.listAccepted` direto (não `ListFriendsUseCase`, que é paginado) via port própria (`FriendGraphReader`, `infrastructure/friendships/inProcessFriendGraphReader.ts`) — mesmo padrão de `modules/ranking`'s `inProcessFriendGraphReader.ts` (achado 6.9.1).
