# `daily` — Diário Selucra (jogo diário)

Módulo: `backend/src/modules/daily/`. Jogo diário com dois cartões, igual para todos no mesmo dia: **Palavra do dia** (estilo Termo) e **Pergunta do dia** (`trivia`, múltipla escolha). A Linha do tempo saiu pela DI18 (2026-10-22), com as rotas e os campos dela. Decisões em `.claude/backlog-diario.md`.

**Regras que valem para todas as rotas abaixo:**

- **O gabarito nunca vai ao navegador antes de o cartão terminar** (DP3). O servidor avalia cada palpite, inclusive as cores do Termo. A resposta da palavra, `correctIndex` e a explicação da pergunta só saem na resposta que encerra o cartão.
- **Dia do jogo = dia UTC**, a mesma regra do streak (DI5). O jogo novo aparece às 00:00 UTC, **21h de Brasília**. O número do jogo é "dias desde a estreia + 1" (o jogo do dia da estreia é o #1).
- **Só o dia atual e os anteriores existem** (seção 3.6): um número maior que o de hoje, inexistente, malformado, ou com o Diário desligado, responde sempre o mesmo `404 { "error": "not_found" }`, para não revelar se o jogo de amanhã já está pronto. O relógio do navegador não manda em nada.
- **Antes da estreia nenhuma rota de jogo funciona:** `409 { "error": "not_started", "startDate", "startsAt" }` (`startsAt` é o instante ISO 00:00 UTC do dia da estreia).
- Respostas com `Cache-Control: no-store`.
- **Sem login o servidor não guarda estado:** o progresso anônimo fica no navegador. Nada jogado sem login é importado (DI8).
- **Com login** (`Authorization: Bearer`, opcional nas quatro rotas de jogo; um token inválido é `401`, nunca vira anônimo em silêncio) as mesmas rotas gravam em `daily_results`: uma tentativa válida por cartão por jogo, com os palpites e as respostas dadas (nunca o gabarito). Gravação e fechamento do jogo são uma operação só, com a linha travada: com duas abas só uma chamada fecha o jogo e só ela concede XP e streak.
- **Resposta que fecha o jogo** traz `completion` (só logado): `{ "correctCards": 0-2, "xpAwarded": number }`. **Só o jogo do dia, concluído antes da virada, vale XP** (DI6 revisto pela DI18: 20 + 15 por cartão certo, de 20 a 50) e toca o streak principal (DI4); nesse caso `completion` traz também `level`, `leveledUp`, `streakMilestone` (`7`, `30` ou `null`) e `unlockedAchievements` (`{ id, name, description }[]`, inclui as conquistas por qualidade do Diário, DI.6.1: ver `.docs/backend/achievements.md`), para o teatro de recompensa. Dia anterior, ou jogo começado num dia e concluído depois da virada, fecha com `xpAwarded: 0`, sem `level` e sem tocar streak.
- **CORS:** estas rotas (as quatro de jogo e `POST /daily/metrics`) aceitam também a origem da landing (`LANDING_URL`, padrão `https://selucra.com.br`), sem credenciais. O resto da API continua só com a origem do app (`FRONTEND_URL`).
- **Rate limit:** 120 requisições por minuto por IP (IP real atrás do proxy, `TRUSTED_PROXY_HOPS`), `429` com `Retry-After`.
- **Conteúdo servido: só jogo publicado** (ponto 058, decisão (b), 2026-10-17). A agenda materializa e, com o Diário agendado ou no ar, **o jogo já nasce publicado** (só o rascunho de estreia espera o admin agendar; o botão "Publicar pendentes" cobre o que sobrar). **Não há etapa de revisão** (decisão de 2026-10-18): o conteúdo nasce pronto, criado e conferido pela skill `diario-conteudo` (`.claude/skills/diario-conteudo/`); as colunas `reviewed_at`/`reviewed_by` ficam no banco só como legado e nada as lê (seção "Painel" abaixo). Jogo materializado e não publicado responde como se não existisse: hoje é `503 game_unavailable`, dia anterior é `404`.

---

### `GET /daily/today`

- **Autenticação:** público.
- **Payload:** nenhum.
- **Sucesso:** `200`, três formas:
  - `{ "status": "off" }` — Diário desligado.
  - `{ "status": "scheduled", "startDate": "2026-11-03", "startsAt": "2026-11-03T00:00:00.000Z" }` — antes da estreia; nenhum conteúdo.
  - `{ "status": "live", "game": <jogo> }` — ver formato do jogo abaixo.
- **Erros:** `503 { "error": "game_unavailable" }` — o Diário está no ar, mas o jogo de hoje não foi materializado.
- **Regra:** `GetTodayUseCase`. Compara a data de estreia com o dia UTC de hoje; o estado nunca contradiz o relógio.

**Formato do jogo** (sem gabarito):

```json
{
  "number": 47,
  "date": "2026-12-17",
  "isToday": true,
  "nextGameAt": "2026-12-18T00:00:00.000Z",
  "cards": {
    "word": { "length": 5, "maxAttempts": 6 },
    "trivia": { "question": "...", "options": ["...", "..."] }
  }
}
```

`isToday: false` num dia anterior (jogável sem XP, sem streak).

---

### `GET /daily/archive`

- **Autenticação:** público (mesmo limite por IP das outras rotas `/daily`). Registrada antes de `/daily/:number`.
- **Payload:** nenhum.
- **Sucesso:** `200` →
  ```json
  { "games": [ {
      "number": 47, "date": "2026-12-16",
      "word": { "answer": "AÇÕES", "length": 5, "definition": "...", "learnMore": null },
      "trivia": { "question": "...", "options": ["..."], "correctIndex": 1, "explanation": "...", "sourceRef": "...", "learnMore": null }
  } ] }
  ```
  Do mais recente ao mais antigo. Os jogos jogados antes da DI18 continuam aqui, só com a palavra e a pergunta.
- **Erros:** nenhum esperado. Diário desligado ou antes da estreia responde `200` com `{ "games": [] }` (nada é revelado).
- **Regra:** `GetArchiveUseCase`, via `DailyGameLoader`. Traz **só jogos já encerrados** (número menor que o de hoje, na virada de 00:00 UTC): o jogo do dia e os futuros nunca entram, então o gabarito exposto aqui já não é segredo. Dia anterior sem jogo publicado é só um buraco. Consumida pelo build da landing (DI.3.4), que gera `/diario/arquivo/`; sem cache (`no-store`), quem guarda é o build.

---

### `GET /daily/:number`

- **Autenticação:** público.
- **Payload:** `:number` inteiro positivo.
- **Sucesso:** `200` → `<jogo>` (mesmo formato acima).
- **Erros:** `404 not_found` — número futuro, inexistente, malformado, Diário desligado, ou dia anterior sem jogo materializado; `409 not_started` — antes da estreia; `503 game_unavailable` — hoje sem jogo materializado.
- **Regra:** `GetGameUseCase`, via `DailyGameLoader`, o único ponto que decide acesso por número.

---

### `POST /daily/:number/word/guess`

- **Autenticação:** opcional (Bearer).
- **Payload:** `{ "guess": string (1 a 32), "attempt"?: inteiro de 1 a 6 }`. `guess` ignora maiúsculas e acento (`acoes` vale por `AÇÕES`). `attempt` é a tentativa corrente, **obrigatório sem login** (o servidor não guarda estado) e ignorado com login (vale a gravada).
- **Sucesso:** `200` → `{ "letters": ["correct" | "present" | "absent", ...], "solved": boolean, "attempt": number, "finished": boolean }` (mais `completion` quando fecha o jogo, logado). Quando o cartão termina (acertou, ou `attempt` = 6), vem também `"reveal": { "answer": "AÇÕES", "definition": string, "learnMore": { "kind": "lesson" | "glossary" | "guide", "ref": string } | null }`. Letra repetida segue o Termo: cada amarelo consome uma ocorrência ainda não casada.
- **Erros:** `400` payload inválido; `404`/`409`/`503` como acima; `422 { "error": "invalid_guess", "reason": "invalid_characters" | "invalid_length" | "wrong_length" }` — formato que não serve ao jogo (4 a 9 letras, do tamanho da resposta); `422 { "error": "word_not_accepted" }` — sequência que não é palavra da lista aceita (VERO + extras). Os dois `422` **não gastam tentativa**. `400 { "error": "attempt_required" }` — sem login e sem `attempt`. `401` — token inválido. `409 { "error": "already_answered" }` — logado, o cartão já terminou (acertou ou 6 tentativas).
- **Regra:** `EvaluateWordGuessUseCase`. A própria resposta é sempre aceita, mesmo fora da lista. Quem mente em `attempt` só entrega a resposta a si mesmo (sem login não há XP).

---

### `POST /daily/:number/cards/trivia/answer`

- **Autenticação:** opcional (Bearer).
- **Payload:** `{ "choice": inteiro de 0 a 20 }` (índice da alternativa).
- **Sucesso:** `200` → `{ "correct": boolean, "correctIndex": number, "explanation": string, "sourceRef": string, "learnMore": {...} | null }`.
- **Erros:** `400` payload inválido; `404`/`409`/`503` como acima; `422 { "error": "invalid_choice" }` — índice fora das alternativas; `401` token inválido; `409 already_answered` — logado, o cartão já foi respondido (a primeira resposta vale e não muda). Logado, o corpo da resposta ganha `completion` se esta resposta fecha o jogo.
- **Regra:** `AnswerTriviaUseCase`. Uma resposta por cartão; o gabarito volta junto da explicação. Com dois cartões, é a resposta da pergunta ou o último palpite da palavra que fecha o jogo.

### `POST /daily/:number/cards/:card/answer` com outro cartão

- **Erros:** `400 { "error": "invalid_card" }` para qualquer `:card` que não seja `trivia`, inclusive `timeline` (a Linha do tempo saiu pela DI18) e `word` (que tem rota própria). O cartão é validado antes do número do jogo.

---

### `GET /daily/:number/me`

- **Autenticação:** Bearer token.
- **Payload:** `:number` inteiro positivo.
- **Sucesso:** `200` → o estado salvo do usuário naquele jogo, para redesenhar a tela em qualquer aparelho:

```json
{
  "number": 47,
  "completed": true,
  "xpAwarded": 50,
  "word": {
    "guesses": [{ "guess": "CARRO", "letters": ["present", "absent", "..."] }],
    "finished": true,
    "solved": true,
    "reveal": { "answer": "AÇÕES", "definition": "...", "learnMore": null }
  },
  "trivia": { "answered": true, "choice": 1, "correct": true, "correctIndex": 1, "explanation": "...", "sourceRef": "...", "learnMore": null }
}
```

  Cartão não respondido vem como `{ "answered": false }` (a palavra, como `guesses: []`, `finished: false`). As cores dos palpites são recalculadas contra a resposta; o gabarito de cada cartão (`reveal`, `correctIndex`) só aparece depois de o cartão terminar. Os palpites voltam sem acento, em maiúsculas (a forma normalizada que foi gravada).
- **Erros:** `401`; `404`/`409`/`503` como as outras rotas com número (jogo futuro é `404`).
- **Regra:** `GetMyGameStateUseCase`. Sem jogada gravada, tudo vem como não respondido.

---

### `POST /daily/metrics`

- **Autenticação:** público (nenhum token é lido).
- **Payload:** `{ "event": "started" | "completed" | "signup" | "login" }`, **só isso** (campo extra é `400`). `started` e `completed` vêm da página pública da landing (um jogo de **hoje** começou ou terminou, uma vez por navegador); `signup` e `login` vêm do app, de quem chegou com `?origem=diario`.
- **Sucesso:** `204`, sem corpo.
- **Erros:** `400` payload inválido; `429` rate limit de `/daily`.
- **Regra:** `RecordDailyMetricUseCase` soma 1 ao contador do dia UTC em que o aviso chegou (`daily_metrics`, PK `(metric_date, metric)`, upsert atômico). **Nada de pessoa é gravado**: sem usuário, IP, aparelho ou número de jogo, só o nome do evento e o dia (DI.7.1). O contador é uma estimativa (o aviso vem do navegador, então quem limpa os dados pode contar de novo e qualquer um pode chamar a rota); quem tem conta é medido por `daily_results`, que não passa por aqui.

---

### `GET /daily/me/stats`

- **Autenticação:** Bearer token.
- **Payload:** nenhum.
- **Sucesso:** `200` → `{ "games", "word": { "played", "correct", "accuracy" }, "trivia": {...}, "wordAttempts": { "distribution": { "1": n, ..., "6": n }, "failed": n }, "currentStreak", "longestStreak" }`. `games` são os jogos concluídos (inclui dias anteriores); `accuracy` é 0 a 100; `distribution` conta os acertos do Termo por número de tentativas.
- **Regra:** `GetMyStatsUseCase`. **Sequência do Diário** = jogos seguidos concluídos **no próprio dia** (os que renderam XP); dia anterior jogado depois não conta (seção 3.6). A sequência atual segue viva enquanto o jogo de hoje ainda não foi concluído, desde que o de ontem tenha sido. Só conta o que foi jogado logado (DI8).

---

**Limite conhecido do modo sem login:** como não há estado, quem quiser pode chamar a rota de resposta várias vezes (testar as quatro alternativas, ou ordens diferentes) e descobrir o gabarito de qualquer dia jogável. Isso não rende nada: o que vale XP e streak é o jogo logado, em que há uma tentativa válida por cartão.


---

## Painel (`/admin/daily`, DI.5.1)

Rotas em `backend/src/modules/admin/interfaces/http/adminDailyRouter.ts`; as regras vivem em `modules/daily/application/useCases/admin/` e o módulo `admin` só audita e expõe (mesmo desenho do painel das lições). **Todas exigem Bearer token + `role: 'admin'`** (`401`/`403`). Aqui, e só aqui, o gabarito aparece: o admin precisa dele para conferir. Corpo e resposta em snake_case.

Erros comuns: `400` formato (Zod); `404` item ou jogo inexistente; `409 { error, code }` estado que não deixa (`already_started`, `not_in_future`, `insufficient_content`, `confirmation_required`, `duplicate`, `word_in_use`); `422 { error, code: "invalid_daily_content", problems: string[] }` regra de conteúdo (fonte, travessão, lista aceita, categoria). Toda escrita é auditada (`daily.*`, `result = failed` na recusa, com a mensagem), com chave estável e nomes de campo, nunca o texto.

### `GET /admin/daily`

- **Sucesso:** `200` com tudo da tela principal: `status` (`off` | `scheduled` | `live`), `start_date`, `today` (UTC), `can_change_start`, `agenda_from`, `ready_days_ahead` e `published_days_ahead` (dias **consecutivos** a partir de `agenda_from`), `min_days_to_schedule` (30), `low_cover_threshold` (14), `alerts`, `days[]`, `coverage` e `bank`.
  - `alerts`: `low_ready_cover` (estreia agendada ou no ar com menos de 14 dias prontos à frente), `scheduled_below_minimum` (agendado com menos de 30 dias prontos), `today_not_published` (no ar e o jogo de hoje não existe ou não está publicado).
  - `days[]`: `{ number, date, published, origins: { word, question }, word, question }`, com categoria e marcador `brasil`/`fora` de cada cartão. Até 45 dias a partir de `agenda_from` (hoje no ar; a estreia quando agendado; o primeiro rascunho quando desligado).
  - `coverage`: `{ window_days: 30, word, trivia }`, cada um `{ total, brasil, fora, by_category }`.
  - `bank`: itens ativos (`words`, `questions`) e `accepted_extra`.

### `GET /admin/daily/metrics`

- **Payload:** query `days` (inteiro de 1 a 90, padrão 30).
- **Sucesso:** `200 { "days": [{ "date", "anon_started", "anon_completed", "logged_started", "logged_completed", "signups", "logins" }] }`, um por dia UTC, do mais recente ao mais antigo, com zero nos dias sem registro. `logged_*` saem de `daily_results` (iniciados pelo dia UTC de `started_at`, concluídos pelo de `completed_at`, inclusive dia anterior e fechado depois da virada: é o jogo, não o XP); `anon_*`, `signups` e `logins` são os contadores de `POST /daily/metrics`.
- **Erros:** `400` `days` inválido; `401`/`403`.
- **Regra:** `GetDailyMetricsUseCase`. Leitura, sem auditoria.

### `POST /admin/daily/draft`

- **Payload:** `{ "start_date": "AAAA-MM-DD" }`.
- **Sucesso:** `200` → `{ start_date, created, warnings: [{ date, code }] }`. Gera o rascunho de 30 dias para uma estreia **candidata**, sem gravar a data (sem isso não haveria como agendar: a agenda só materializa depois da estreia gravada, e a estreia só grava com dias prontos). Se a data difere da agendada, os jogos publicados saem do ar (jogo publicado não se renumera).
- **Erros:** `409 already_started` (Diário no ar), `409 not_in_future` (data de hoje ou passada), `400`.

### `PUT /admin/daily/start-date`

- **Autenticação extra:** **senha recente** (`401 { error: "reauth_required" }`, N.22): é a ação que decide quando o jogo vai ao ar.
- **Payload:** `{ "start_date": "AAAA-MM-DD" | null }` (`null` desliga).
- **Sucesso:** `200` → `{ start_date, status, published: number[] }`. Grava a data, realinha (renumera) os jogos não publicados e **publica todos em lote** (ponto 058). Antes de gravar, tudo é tirado do ar, porque a data pode ter andado.
- **Erros:** `409 already_started` (depois do início a data não muda mais, nem desliga), `409 not_in_future`, `409 insufficient_content` (exige **30 dias consecutivos** de jogos prontos a partir da data).

### `POST /admin/daily/puzzles/publish`

- **Payload:** `{ "numbers"?: number[] }`. Sem `numbers`, publica todo jogo que ainda não está no ar.
- **Sucesso:** `200` → `{ published: number[] }` (os que passaram a estar no ar nesta chamada).
- **Erros:** `404` (com `numbers`, jogo inexistente).

### `GET /admin/daily/puzzles/:number`

- **Sucesso:** `200` → prévia do dia **como o jogador verá**, mais o gabarito: `{ number, date, is_today_or_past, published_at, origins: { word, question }, word, question, warnings }`. Vale para qualquer jogo materializado, futuro inclusive. As rotas públicas nunca fazem isto.
- **Erros:** `404` (inexistente ou número malformado).

### `PUT /admin/daily/puzzles/:number/card`

- **Payload:** `{ card: "word", word_id }` | `{ card: "question", question_id }`, mais `confirm_published?: boolean` (padrão `false`).
- **Sucesso:** `200` → `{ number }`. Troca o cartão e marca a origem como `manual`.
- **Erros:** `409 confirmation_required` (jogo publicado sem `confirm_published`), `404`, `400` (`card: "timeline"` não existe mais), `422` (item desativado).

### Conteúdo: palavras e perguntas

`GET /admin/daily/words`, `/questions` → `{ words | questions: [...] }`, **todos**, desativados inclusive. `POST` cria (`201`); `PATCH /:id` edita (parcial, ao menos um campo, mais `confirm_published?`) e responde `{ word | question, affected_puzzles: number[] }`. As rotas `/admin/daily/events` saíram com a Linha do tempo (DI18) e respondem `404`.

- **Campos comuns:** `category` (lista fechada de `content/categories.ts`), `scope` (`brasil` | `fora`), `learn_more` (`{ kind: lesson|glossary|guide, ref } | null`), `active` (só no `PATCH`; é o desativar).
- **Palavra:** `display`, `definition`. A **resposta** (`answer`) é a identidade da palavra e **não muda**: no `PATCH`, `display` precisa continuar sendo a mesma palavra. No `POST`, a resposta precisa estar na lista aceita (VERO ou extra) e não pode repetir (`409 duplicate`).
- **Pergunta:** `question`, `options` (2 a 6), `correct_index`, `explanation` (até 280), `source_ref` (**obrigatória**: fonte primária).
- **Regras de impacto no `PATCH`:** editar o que o jogador vê (texto, alternativas, gabarito, fonte) não derruba nada; se algum dia que o usa já está publicado, exige `confirm_published: true` (`409 confirmation_required`). Desativar não tira o item de um jogo já montado: `affected_puzzles` lista onde ele ainda aparece para o admin trocar.

### Lista extra de palavras aceitas

- `GET /admin/daily/accepted-words` → `{ words: string[] }` (só a extra; a do dicionário VERO não se edita aqui).
- `POST /admin/daily/accepted-words` `{ word }` → `201 { word }` (normalizada, 4 a 9 letras; `409 duplicate` se já é aceita).
- `DELETE /admin/daily/accepted-words/:word` → `200 { word }`. `409 word_in_use` se é palavra-resposta de algum cadastro (o jogador precisa poder digitar a resposta); `404` se não está na extra.
