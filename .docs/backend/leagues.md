# Módulo `leagues` (ligas privadas do PRO)

Backlog: `.claude/backlog-monetizacao.md` (MO.5.2). Quem é PRO cria ligas com amigos; qualquer amigo convidado participa **sem plano**. A pontuação é fixa: **rentabilidade percentual da janela do ranking oficial** (semana ou mês, critério geral), lida do mesmo snapshot do ranking (`RankUsersByProfitabilityUseCase`, módulo `ranking`). Nunca patrimônio absoluto (RNF09). O ranking Global/Amigos não é tocado.

**Limites (decisão de 2026-10-10):** até 3 ligas abertas por dono; até 20 pessoas por liga (membros ativos mais convites pendentes). Os dois tetos são garantidos no banco, em transação com trava de linha.

**Arquivamento:** liga cujo dono não é PRO agora fica `archived: true` (derivado do plano a cada leitura, nada é gravado ou apagado). Continua visível, com classificação; só criar, convidar e renomear (capacidades do dono) exigem PRO. Reativar o plano tira o `archived` sozinho. Encerrar (`DELETE`) é voluntário, libera a vaga das 3 e faz a liga sumir das listagens, sem apagar dados.

**Quem é de fora:** liga que não existe, está encerrada ou da qual a pessoa não participa responde `404` (nunca revela que existe).

Erros comuns a todas as rotas: `401` sem token, `400` id que não é UUID.

### `GET /leagues`

- **Autenticação:** Bearer token (não exige PRO)
- **Sucesso:** `200` `{ leagues: [{ id, name, window, ownerId, ownerUsername, isOwner, status, archived, memberCount }] }`. `status`: `active` ou `invited` (convite pendente para a pessoa). `memberCount` conta só quem participa.

### `POST /leagues`

- **Autenticação:** Bearer token + plano PRO
- **Payload:** `{ name: string, window: 'week' | 'month' }` (Zod; nome de 3 a 40 caracteres depois de aparar espaços)
- **Sucesso:** `201` `{ league: { id, ownerId, name, window, createdAt, closedAt } }`; o dono entra como membro ativo
- **Erros:** `400` corpo ou nome inválido; `403 { error: 'requer plano PRO' }`; `409` já tem 3 ligas abertas

### `GET /leagues/:id`

- **Autenticação:** Bearer token (membro ativo ou convidado)
- **Sucesso:** `200` `{ league: <resumo>, standings: [{ position, userId, username, name, avatarUrl, level, profitabilityPct, isYou, cosmetics }], pendingInvites: [{ userId, username }], updatedAt }`. `standings` ordena por `profitabilityPct` (`null`, quando não deu para pontuar agora, fica no fim); vazio para quem só foi convidado. `pendingInvites` só vem preenchido para o dono. `updatedAt` é o instante do snapshot de base (`null` se calculado na hora).
- **Erros:** `404`

### `PATCH /leagues/:id`

- **Autenticação:** Bearer token + plano PRO (dono)
- **Payload:** `{ name }`. **Sucesso:** `204`. **Erros:** `400`, `403 requer plano PRO`, `403` não é o dono, `404`

### `DELETE /leagues/:id`

- **Autenticação:** Bearer token (dono; não exige PRO). **Sucesso:** `204`. **Erros:** `403` não é o dono, `404`

### `POST /leagues/:id/invitations`

- **Autenticação:** Bearer token + plano PRO (dono)
- **Payload:** `{ userId: uuid }`. **Sucesso:** `201`
- **Erros:** `403 requer plano PRO`; `403` não é o dono, ou a pessoa não é amiga aceita; `404`; `409` já está na liga/convidada, ou liga cheia

### `POST /leagues/:id/invitation`

- **Autenticação:** Bearer token (quem foi convidado; nunca exige PRO)
- **Payload:** `{ accept: boolean }`. **Sucesso:** `204` (aceitar ativa a participação; recusar remove o convite)
- **Erros:** `404` sem convite pendente ou liga inexistente; `409` ao aceitar quando a pessoa já integra 10 ligas ativas (teto de participação, ponto 047; recusar continua possível)

### `POST /leagues/:id/leave`

- **Autenticação:** Bearer token. **Sucesso:** `204`. **Erros:** `400` o dono não sai (encerra), `404`

### `DELETE /leagues/:id/members/:userId`

- **Autenticação:** Bearer token (dono; não exige PRO, para quem cancelou ainda poder limpar a lista)
- **Sucesso:** `204` (tira o membro ou cancela o convite pendente). **Erros:** `400` o dono não se remove, `403` não é o dono, `404`
