# Módulo `duels` (duelos entre amigos, PRO)

Backlog: `.claude/backlog-monetizacao.md` (MO.5.3). Desafio 1 contra 1 entre amigos aceitos, **7 dias a partir do aceite**, vence a maior **rentabilidade percentual** do período (a mesma fórmula do ranking, medida por replay do log de eventos nos instantes de início e fim). Só percentual: nunca patrimônio absoluto (RNF09). **Criar (desafiar) exige PRO; aceitar ou recusar nunca.**

**Regras fechadas (2026-10-10):** até 3 duelos simultâneos por pessoa (ativos nos dois lados mais desafios que a pessoa fez e aguardam resposta; desafio recebido não ocupa vaga até ser aceito); empate é empate (mesma rentabilidade na precisão exibida de 2 casas); quem não opera durante o duelo perde por abandono (os dois sem operar: empate); XP só por participar, **20 XP fixos** para cada pessoa que operou, igual para quem ganha, perde ou empata (quem abandonou não ganha). Escolha minha, a revisar: o valor do XP e o prazo de 7 dias para o desafiado responder (depois o desafio expira e libera a vaga de quem desafiou).

**Estados:** `pending` (aguardando resposta), `active`, `finished`, `declined`, `cancelled` (quem desafiou desistiu), `expired`. O resultado é gravado uma única vez e nunca muda; nada é apagado. **Cancelar o PRO nunca interrompe um duelo**: ele termina normalmente.

**Encerramento (job):** `SettleDueDuelsUseCase`, a cada 1 h (`DUEL_SETTLE_INTERVAL_MS`) e uma vez na subida do backend: encerra os duelos que chegaram ao fim, expira desafios vencidos e credita o XP. Idempotente em todos os passos (transições condicionais ao estado; `xp_awarded_at`); falha ao medir (motor fora do ar) deixa o duelo ativo para a próxima rodada. O resultado independe da hora em que o job roda. Ressalva: se o crédito de XP falhar no meio, a rodada seguinte pode creditar de novo 20 XP a quem já tinha recebido (valor pequeno, aceito).

**Feed:** o resultado vira item do feed social só para quem venceu (ou quem desafiou, no empate); ver `socialfeed.md`. E-mail de resultado (opt-in) não foi implementado.

Erros comuns: `401` sem token, `400` id que não é UUID. Quem não participa do duelo recebe `404`.

### `GET /duels`

- **Autenticação:** Bearer token (não exige PRO)
- **Sucesso:** `200` `{ duels: DuelView[] }`, os 50 mais recentes, com os encerrados arquivados. `DuelView`: `{ id, status, role: 'challenger'|'opponent', opponent: { id, username, name, avatarUrl, cosmetics }, createdAt, expiresAt, startsAt, endsAt, finishedAt, result: 'won'|'lost'|'draw'|null, reason: 'profitability'|'abandonment'|'tie'|'both_inactive'|null, you, them }`. `you`/`them`: `{ returnPct, operated }` do resultado gravado (só em encerrados; `null` nos demais na lista).

### `POST /duels`

- **Autenticação:** Bearer token + plano PRO
- **Payload:** `{ opponentId: uuid }` (Zod)
- **Sucesso:** `201` `{ duel: DuelView }` (`status: 'pending'`)
- **Erros:** `400` corpo inválido ou desafiar a si mesmo; `403 { error: 'requer plano PRO' }`; `403` a pessoa não é amiga aceita; `409` já tem 3 duelos em andamento, ou já existe duelo aberto entre as duas pessoas

### `GET /duels/:id`

- **Autenticação:** Bearer token (só os dois participantes)
- **Sucesso:** `200` `{ duel: DuelView }`. Em duelo `active`, `you`/`them` trazem o **placar parcial de agora** (`null` se não deu para medir); em encerrado, o resultado gravado.
- **Erros:** `404`

### `POST /duels/:id/response`

- **Autenticação:** Bearer token (quem foi desafiado; nunca exige PRO)
- **Payload:** `{ accept: boolean }`. **Sucesso:** `204` (aceitar inicia o duelo agora, por 7 dias)
- **Erros:** `403` não é quem foi desafiado; `404`; `409` o desafio não está mais aguardando (vencido, cancelado ou já respondido) ou o desafiado já tem 3 duelos em andamento

### `DELETE /duels/:id`

- **Autenticação:** Bearer token (quem desafiou; não exige PRO). **Sucesso:** `204`
- **Erros:** `403` não é quem desafiou; `404`; `409` só dá para cancelar um desafio ainda não aceito
