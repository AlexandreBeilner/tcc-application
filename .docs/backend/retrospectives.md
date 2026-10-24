# Módulo `retrospectives` (retrospectiva mensal)

Backlog: `.claude/backlog-monetizacao.md` (MO.5.4). Resumo da jornada de um **mês fechado**, calculado só de dados que já existem. Nunca patrimônio absoluto (RNF09): só contagens, nível, dias de atividade e rentabilidade percentual.

**Conteúdo (igual para todos):** lições concluídas no mês, conquistas do mês, nível, calendário de dias com atividade (dia presente = manteve a sequência, ausente = dia off), maior sequência do mês, melhor rentabilidade do mês (a mesma do ranking, medida por replay do mês inteiro), duelos jogados e vencidos, ligas em que participa.

**Arquivo:** cada retrospectiva é gravada uma vez (`retrospectives`, jsonb) e nunca recalculada, então rever um mês antigo dá sempre o mesmo resultado. Gerada pelo job mensal e, se faltar, na primeira leitura.

**Dias de atividade:** tabela `daily_activity` (um dia por linha), alimentada pelo `TouchStreakUseCase` a cada atividade qualificadora (lição ou missão concluída). A migração `0040` preenche o que já existia a partir das lições concluídas; missões e dias sem lição não têm registro anterior, então o calendário só fica completo daqui para frente. Não há histórico de XP (a evolução de nível não faz parte do cartão: mostra-se o nível atual).

**Job:** a cada 1 h (`RETROSPECTIVE_INTERVAL_MS`) e na subida, gera a do mês que acabou para as contas ativas que ainda não têm. Idempotente; uma conta que falha (ex.: motor fora do ar) não para as outras e é tentada de novo na rodada seguinte; nada é gravado pela metade.

Erros comuns: `401` sem token.

### `GET /retrospectives`

- **Autenticação:** Bearer token
- **Sucesso:** `200` `{ months: ['2026-09', ...] }`, mais recentes primeiro, do mês da criação da conta até o mês anterior ao atual, no máximo 12. Conta nova ainda sem mês fechado: lista vazia.

### `GET /retrospectives/:month`

- **Autenticação:** Bearer token
- **Parâmetro:** `month` no formato `AAAA-MM`
- **Sucesso:** `200` `{ retrospective: { month, lessonsCompleted, achievementsUnlocked, achievementNames, level, activeDays: number[], daysInMonth, longestStreak, bestReturnPct, duelsPlayed, duelsWon, leaguesActive, empty } }` (até 2026-10-24 a parte do calendário em diante vinha num objeto `premium`, só para PRO). `empty: true` quando nada aconteceu no mês (a tela mostra texto acolhedor).
- **Erros:** `404` mês mal formado, anterior à conta ou ainda não fechado
