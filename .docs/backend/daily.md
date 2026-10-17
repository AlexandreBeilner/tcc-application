# `daily` — Diário Selucra (jogo diário)

Módulo: `backend/src/modules/daily/`. Jogo diário com três cartões, igual para todos no mesmo dia: **Palavra do dia** (estilo Termo), **Pergunta do dia** (`trivia`, múltipla escolha) e **Linha do tempo** (ordenar 4 eventos). Decisões em `.claude/backlog-diario.md`.

**Regras que valem para todas as rotas abaixo:**

- **O gabarito nunca vai ao navegador antes de o cartão terminar** (DP3). O servidor avalia cada palpite, inclusive as cores do Termo. A resposta da palavra, `correctIndex`, o ano e a explicação dos eventos só saem na resposta que encerra o cartão.
- **Dia do jogo = dia UTC**, a mesma regra do streak (DI5). O jogo novo aparece às 00:00 UTC, **21h de Brasília**. O número do jogo é "dias desde a estreia + 1" (o jogo do dia da estreia é o #1).
- **Só o dia atual e os anteriores existem** (seção 3.6): um número maior que o de hoje, inexistente, malformado, ou com o Diário desligado, responde sempre o mesmo `404 { "error": "not_found" }`, para não revelar se o jogo de amanhã já está pronto. O relógio do navegador não manda em nada.
- **Antes da estreia nenhuma rota de jogo funciona:** `409 { "error": "not_started", "startDate", "startsAt" }` (`startsAt` é o instante ISO 00:00 UTC do dia da estreia).
- Respostas com `Cache-Control: no-store`.
- **Sem login o servidor não guarda estado:** o progresso anônimo fica no navegador. Nada jogado sem login é importado (DI8).
- **Com login** (`Authorization: Bearer`, opcional nas quatro rotas de jogo; um token inválido é `401`, nunca vira anônimo em silêncio) as mesmas rotas gravam em `daily_results`: uma tentativa válida por cartão por jogo, com os palpites e as respostas dadas (nunca o gabarito). Gravação e fechamento do jogo são uma operação só, com a linha travada: com duas abas só uma chamada fecha o jogo e só ela concede XP e streak.
- **Resposta que fecha o jogo** traz `completion` (só logado): `{ "correctCards": 0-3, "xpAwarded": number }`. **Só o jogo do dia, concluído antes da virada, vale XP** (DI6: 20 + 10 por cartão certo, de 20 a 50) e toca o streak principal (DI4); nesse caso `completion` traz também `level`, `leveledUp`, `streakMilestone` (`7`, `30` ou `null`) e `unlockedAchievements` (`{ id, name, description }[]`), para o teatro de recompensa. Dia anterior, ou jogo começado num dia e concluído depois da virada, fecha com `xpAwarded: 0`, sem `level` e sem tocar streak.
- **CORS:** estas quatro rotas aceitam também a origem da landing (`LANDING_URL`, padrão `https://selucra.com.br`), sem credenciais. O resto da API continua só com a origem do app (`FRONTEND_URL`).
- **Rate limit:** 120 requisições por minuto por IP (IP real atrás do proxy, `TRUSTED_PROXY_HOPS`), `429` com `Retry-After`.
- Conteúdo servido: todo jogo materializado, publicado ou não (ponto em aberto 058).

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
    "trivia": { "question": "...", "options": ["...", "..."] },
    "timeline": { "events": [{ "id": "<uuid>", "label": "Plano Real" }] }
  }
}
```

A ordem de `timeline.events` é a de exibição (embaralhada de propósito). `isToday: false` num dia anterior (jogável sem XP, sem streak).

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
- **Regra:** `AnswerTriviaUseCase`. Uma resposta por cartão; o gabarito volta junto da explicação.

---

### `POST /daily/:number/cards/timeline/answer`

- **Autenticação:** opcional (Bearer).
- **Payload:** `{ "order": string[] (1 a 12 ids) }` — os ids de `cards.timeline.events` na ordem que a pessoa montou.
- **Sucesso:** `200` → `{ "correct": boolean, "positionHits": boolean[], "events": [{ "id", "label", "year", "explanation", "sourceRef", "learnMore" }] }`. `positionHits` é por posição da ordem enviada; `events` vem na ordem cronológica certa, já com o ano.
- **Erros:** `400` payload inválido; `404`/`409`/`503` como acima; `422 { "error": "invalid_order" }` — não é uma permutação exata dos eventos do jogo (não gasta a tentativa); `401` token inválido; `409 already_answered` — logado, o cartão já foi respondido. Logado, o corpo da resposta ganha `completion` se esta resposta fecha o jogo.
- **Regra:** `AnswerTimelineUseCase`; só a ordem cronológica exata acerta.

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
  "trivia": { "answered": true, "choice": 1, "correct": true, "correctIndex": 1, "explanation": "...", "sourceRef": "...", "learnMore": null },
  "timeline": { "answered": true, "order": ["<uuid>"], "correct": true, "positionHits": [true], "events": [{ "id": "...", "label": "...", "year": 1994, "explanation": "...", "sourceRef": "...", "learnMore": null }] }
}
```

  Cartão não respondido vem como `{ "answered": false }` (a palavra, como `guesses: []`, `finished: false`). As cores dos palpites são recalculadas contra a resposta; o gabarito de cada cartão (`reveal`, `correctIndex`, anos) só aparece depois de o cartão terminar. Os palpites voltam sem acento, em maiúsculas (a forma normalizada que foi gravada).
- **Erros:** `401`; `404`/`409`/`503` como as outras rotas com número (jogo futuro é `404`).
- **Regra:** `GetMyGameStateUseCase`. Sem jogada gravada, tudo vem como não respondido.

---

### `GET /daily/me/stats`

- **Autenticação:** Bearer token.
- **Payload:** nenhum.
- **Sucesso:** `200` → `{ "games", "word": { "played", "correct", "accuracy" }, "trivia": {...}, "timeline": {...}, "wordAttempts": { "distribution": { "1": n, ..., "6": n }, "failed": n }, "currentStreak", "longestStreak" }`. `games` são os jogos concluídos (inclui dias anteriores); `accuracy` é 0 a 100; `distribution` conta os acertos do Termo por número de tentativas.
- **Regra:** `GetMyStatsUseCase`. **Sequência do Diário** = jogos seguidos concluídos **no próprio dia** (os que renderam XP); dia anterior jogado depois não conta (seção 3.6). A sequência atual segue viva enquanto o jogo de hoje ainda não foi concluído, desde que o de ontem tenha sido. Só conta o que foi jogado logado (DI8).

---

**Limite conhecido do modo sem login:** como não há estado, quem quiser pode chamar a rota de resposta várias vezes (testar as quatro alternativas, ou ordens diferentes) e descobrir o gabarito de qualquer dia jogável. Isso não rende nada: o que vale XP e streak é o jogo logado, em que há uma tentativa válida por cartão.
