import express from 'express'
import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createDailyRouter } from './dailyRouter'
import { CORRECT_ORDER, DISPLAY_ORDER, START, buildDailyWorld } from '../../test/dailyWorld'

// Instantes em torno da virada do dia do Diário (00:00 UTC = 21h de Brasília).
const AT = {
  // 2026-11-02 20:59 em Brasília (23:59 UTC): ainda é o jogo #2.
  brasilia2059: new Date('2026-11-02T23:59:00.000Z'),
  // 2026-11-02 21:00 em Brasília (00:00 UTC de 3/11): virou, hoje é o #3.
  brasilia2100: new Date('2026-11-03T00:00:00.000Z'),
  launchDay: new Date('2026-11-01T15:00:00.000Z'),
  beforeLaunch: new Date('2026-10-30T15:00:00.000Z'),
}

function appAt(now: Date, startDate: string | null = START) {
  const world = buildDailyWorld({ startDate })
  const app = express()
  app.use(express.json())
  app.use(createDailyRouter({ ...world, now: () => now }))
  return app
}

// Tudo que revelaria o gabarito de um cartão; nunca pode aparecer antes de o cartão terminar.
const SECRETS = [
  'ACOES',
  'AÇÕES',
  'correctIndex',
  'Pedaços de uma empresa',
  'meta de inflação',
  '1994',
  '2008',
  'Explicação de',
]

describe('GET /daily/today', () => {
  it('responde off quando o Diário está desligado', async () => {
    const res = await request(appAt(AT.launchDay, null)).get('/daily/today')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ status: 'off' })
  })

  it('antes da estreia revela só a data, sem nenhum conteúdo', async () => {
    const res = await request(appAt(AT.beforeLaunch)).get('/daily/today')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      status: 'scheduled',
      startDate: START,
      startsAt: '2026-11-01T00:00:00.000Z',
    })
  })

  it('no ar devolve o jogo do dia sem gabarito e sem cache', async () => {
    const res = await request(appAt(AT.brasilia2059)).get('/daily/today')
    expect(res.status).toBe(200)
    expect(res.headers['cache-control']).toBe('no-store')
    expect(res.body.status).toBe('live')
    expect(res.body.game).toEqual({
      number: 2,
      date: '2026-11-02',
      isToday: true,
      nextGameAt: '2026-11-03T00:00:00.000Z',
      cards: {
        word: { length: 5, maxAttempts: 6 },
        trivia: {
          question: 'Qual índice mede a inflação oficial?',
          options: ['IGP-M', 'IPCA', 'INPC', 'IPC-Fipe'],
        },
        timeline: {
          events: [
            { id: 'ev-crise', label: 'Crise financeira global' },
            { id: 'ev-plano', label: 'Plano Real' },
            { id: 'ev-joesley', label: 'Joesley Day' },
            { id: 'ev-cambio', label: 'Câmbio flutuante' },
          ],
        },
      },
    })
    const raw = JSON.stringify(res.body)
    for (const secret of SECRETS) expect(raw).not.toContain(secret)
  })

  it('o jogo de hoje muda exatamente na virada do dia (20h59 e 21h00 de Brasília)', async () => {
    const before = await request(appAt(AT.brasilia2059)).get('/daily/today')
    const after = await request(appAt(AT.brasilia2100)).get('/daily/today')
    expect(before.body.game.number).toBe(2)
    expect(after.body.game.number).toBe(3)
  })

  it('503 quando hoje não tem jogo materializado', async () => {
    const world = buildDailyWorld({ startDate: START, puzzleCount: 0 })
    const app = express()
    app.use(createDailyRouter({ ...world, now: () => AT.launchDay }))
    const res = await request(app).get('/daily/today')
    expect(res.status).toBe(503)
    expect(res.body).toEqual({ error: 'game_unavailable' })
  })
})

describe('jogo materializado e não publicado (ponto 058)', () => {
  function appWithUnpublished(now: Date) {
    const world = buildDailyWorld({ startDate: START })
    for (const puzzle of world.puzzleRepo.items) puzzle.publishedAt = null
    const app = express()
    app.use(express.json())
    app.use(createDailyRouter({ ...world, now: () => now }))
    return app
  }

  it('hoje não publicado é 503, como se não existisse', async () => {
    const res = await request(appWithUnpublished(AT.launchDay)).get('/daily/today')
    expect(res.status).toBe(503)
    expect(res.body).toEqual({ error: 'game_unavailable' })
  })

  it('dia anterior não publicado é 404', async () => {
    expect((await request(appWithUnpublished(AT.brasilia2100)).get('/daily/1')).status).toBe(404)
  })

  it('as rotas de palpite também não aceitam jogo não publicado', async () => {
    const res = await request(appWithUnpublished(AT.launchDay))
      .post('/daily/1/cards/trivia/answer')
      .send({ choice: 1 })
    expect(res.status).toBe(503)
  })
})

describe('dia anterior sem jogo materializado', () => {
  it('é 404, como um número que não existe', async () => {
    const world = buildDailyWorld({ startDate: START, puzzleCount: 0 })
    const app = express()
    app.use(createDailyRouter({ ...world, now: () => AT.brasilia2100 }))
    expect((await request(app).get('/daily/1')).status).toBe(404)
  })
})

describe('GET /daily/:number e a regra de acesso (seção 3.6)', () => {
  it('dia anterior é acessível', async () => {
    const res = await request(appAt(AT.brasilia2100)).get('/daily/2')
    expect(res.status).toBe(200)
    expect(res.body.number).toBe(2)
    expect(res.body.isToday).toBe(false)
  })

  it('o dia seguinte ao de hoje é 404, às 20h59 e às 21h00 de Brasília', async () => {
    // O jogo #3 e o #4 existem na agenda: o 404 vem da regra de acesso, não da falta de jogo.
    const at2059 = await request(appAt(AT.brasilia2059)).get('/daily/3')
    const at2100 = await request(appAt(AT.brasilia2100)).get('/daily/4')
    expect(at2059.status).toBe(404)
    expect(at2100.status).toBe(404)
    // E o que era "amanhã" às 20h59 abre às 21h00.
    expect((await request(appAt(AT.brasilia2100)).get('/daily/3')).status).toBe(200)
  })

  it('toda rota com número recusa o dia seguinte com o mesmo 404', async () => {
    const app = appAt(AT.brasilia2059)
    const responses = await Promise.all([
      request(app).get('/daily/3'),
      request(app).post('/daily/3/word/guess').send({ guess: 'juros', attempt: 1 }),
      request(app).post('/daily/3/cards/trivia/answer').send({ choice: 1 }),
      request(app).post('/daily/3/cards/timeline/answer').send({ order: CORRECT_ORDER }),
    ])
    for (const res of responses) {
      expect(res.status).toBe(404)
      expect(res.body).toEqual({ error: 'not_found' })
    }
  })

  it('número inexistente, zero, negativo ou malformado é o mesmo 404', async () => {
    const app = appAt(AT.brasilia2100)
    for (const n of ['0', '-1', '1.5', 'abc', '999999', '99999999999']) {
      const res = await request(app).get(`/daily/${n}`)
      expect(res.status).toBe(404)
      expect(res.body).toEqual({ error: 'not_found' })
    }
  })

  it('Diário desligado: nenhuma rota de jogo funciona', async () => {
    const app = appAt(AT.launchDay, null)
    expect((await request(app).get('/daily/1')).status).toBe(404)
    expect(
      (await request(app).post('/daily/1/word/guess').send({ guess: 'juros', attempt: 1 })).status,
    ).toBe(404)
  })

  it('antes da estreia nenhuma rota de jogo funciona e todas dizem quando começa', async () => {
    const app = appAt(AT.beforeLaunch)
    const responses = await Promise.all([
      request(app).get('/daily/1'),
      request(app).post('/daily/1/word/guess').send({ guess: 'juros', attempt: 1 }),
      request(app).post('/daily/1/cards/trivia/answer').send({ choice: 1 }),
      request(app).post('/daily/1/cards/timeline/answer').send({ order: CORRECT_ORDER }),
    ])
    for (const res of responses) {
      expect(res.status).toBe(409)
      expect(res.body).toEqual({
        error: 'not_started',
        startDate: START,
        startsAt: '2026-11-01T00:00:00.000Z',
      })
    }
  })

  it('o jogo do dia da estreia é o #1 e só ele', async () => {
    const app = appAt(AT.launchDay)
    expect((await request(app).get('/daily/1')).status).toBe(200)
    expect((await request(app).get('/daily/2')).status).toBe(404)
  })
})

describe('POST /daily/:number/word/guess', () => {
  const guess = (app: express.Express, body: unknown, n = 1) =>
    request(app)
      .post(`/daily/${n}/word/guess`)
      .send(body as object)

  it('devolve as cores sem a resposta enquanto o cartão não terminou', async () => {
    const res = await guess(appAt(AT.launchDay), { guess: 'carro', attempt: 1 })
    expect(res.status).toBe(200)
    // ACOES x CARRO: C presente, A presente, R/R ausentes, O na posição 4 (ACOES[3] = E, não),
    // então O presente.
    expect(res.body).toEqual({
      letters: ['present', 'present', 'absent', 'absent', 'present'],
      solved: false,
      attempt: 1,
      finished: false,
    })
    const raw = JSON.stringify(res.body)
    for (const secret of SECRETS) expect(raw).not.toContain(secret)
  })

  it('acertar termina o cartão e revela resposta com acento e definição', async () => {
    const res = await guess(appAt(AT.launchDay), { guess: 'AÇÕES', attempt: 3 })
    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      letters: ['correct', 'correct', 'correct', 'correct', 'correct'],
      solved: true,
      attempt: 3,
      finished: true,
      reveal: {
        answer: 'AÇÕES',
        definition: 'Pedaços de uma empresa.',
        learnMore: { kind: 'glossary', ref: 'acao' },
      },
    })
  })

  it('na 6ª tentativa errada também revela a resposta', async () => {
    const res = await guess(appAt(AT.launchDay), { guess: 'moral', attempt: 6 })
    expect(res.status).toBe(200)
    expect(res.body.solved).toBe(false)
    expect(res.body.finished).toBe(true)
    expect(res.body.reveal.answer).toBe('AÇÕES')
  })

  it('palavra fora da lista aceita é recusada (422) sem revelar nada', async () => {
    const res = await guess(appAt(AT.launchDay), { guess: 'xxxxx', attempt: 6 })
    expect(res.status).toBe(422)
    expect(res.body).toEqual({ error: 'word_not_accepted' })
  })

  it('palpite com tamanho ou caracteres errados é recusado (422)', async () => {
    const app = appAt(AT.launchDay)
    expect((await guess(app, { guess: 'amor', attempt: 1 })).body).toEqual({
      error: 'invalid_guess',
      reason: 'wrong_length',
    })
    expect((await guess(app, { guess: 'ca rr', attempt: 1 })).body).toEqual({
      error: 'invalid_guess',
      reason: 'invalid_characters',
    })
  })

  it('payload inválido é 400', async () => {
    const app = appAt(AT.launchDay)
    expect((await guess(app, { guess: 'carro' })).status).toBe(400)
    expect((await guess(app, { guess: 'carro', attempt: 7 })).status).toBe(400)
    expect((await guess(app, { guess: 'carro', attempt: 0 })).status).toBe(400)
    expect((await guess(app, { attempt: 1 })).status).toBe(400)
  })

  it('dia anterior continua jogável', async () => {
    const res = await guess(appAt(AT.brasilia2100), { guess: 'carro', attempt: 1 }, 1)
    expect(res.status).toBe(200)
  })
})

describe('POST /daily/:number/cards/trivia/answer', () => {
  const answer = (body: unknown, n = 1) =>
    request(appAt(AT.launchDay))
      .post(`/daily/${n}/cards/trivia/answer`)
      .send(body as object)

  it('acerto devolve gabarito, explicação e fonte', async () => {
    const res = await answer({ choice: 1 })
    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      correct: true,
      correctIndex: 1,
      explanation: 'O IPCA é a referência da meta de inflação.',
      sourceRef: 'IBGE',
      learnMore: null,
    })
  })

  it('erro diz que errou e mostra a certa', async () => {
    const res = await answer({ choice: 0 })
    expect(res.body.correct).toBe(false)
    expect(res.body.correctIndex).toBe(1)
  })

  it('alternativa fora do intervalo é 422; payload ruim é 400', async () => {
    expect((await answer({ choice: 4 })).body).toEqual({ error: 'invalid_choice' })
    expect((await answer({ choice: -1 })).status).toBe(400)
    expect((await answer({ choice: '1' })).status).toBe(400)
  })
})

describe('POST /daily/:number/cards/timeline/answer', () => {
  const answer = (body: unknown) =>
    request(appAt(AT.launchDay))
      .post('/daily/1/cards/timeline/answer')
      .send(body as object)

  it('ordem certa acerta e revela anos e explicações na ordem cronológica', async () => {
    const res = await answer({ order: CORRECT_ORDER })
    expect(res.status).toBe(200)
    expect(res.body.correct).toBe(true)
    expect(res.body.positionHits).toEqual([true, true, true, true])
    expect(res.body.events.map((e: { id: string; year: number }) => [e.id, e.year])).toEqual([
      ['ev-plano', 1994],
      ['ev-cambio', 1999],
      ['ev-crise', 2008],
      ['ev-joesley', 2017],
    ])
    expect(res.body.events[0].explanation).toBe('Explicação de Plano Real')
  })

  it('ordem errada marca as posições certas', async () => {
    const res = await answer({ order: DISPLAY_ORDER })
    expect(res.body.correct).toBe(false)
    expect(res.body.positionHits).toEqual([false, false, false, false])
  })

  it('só a permutação exata vale (422)', async () => {
    expect((await answer({ order: ['ev-plano', 'ev-cambio', 'ev-crise'] })).body).toEqual({
      error: 'invalid_order',
    })
    expect(
      (await answer({ order: ['ev-plano', 'ev-plano', 'ev-crise', 'ev-joesley'] })).status,
    ).toBe(422)
    expect((await answer({ order: ['ev-plano', 'ev-cambio', 'ev-crise', 'x'] })).status).toBe(422)
    expect((await answer({ order: [] })).status).toBe(400)
  })
})

describe('cartão desconhecido', () => {
  it('word e qualquer outro nome não têm rota de resposta genérica', async () => {
    const app = appAt(AT.launchDay)
    expect((await request(app).post('/daily/1/cards/word/answer').send({})).status).toBe(404)
    expect((await request(app).post('/daily/1/cards/xpto/answer').send({})).status).toBe(404)
  })
})

describe('POST /daily/metrics (DI.7.1)', () => {
  it('soma 1 ao contador do dia UTC, sem login e sem guardar quem avisou', async () => {
    const world = buildDailyWorld({ startDate: START })
    const app = express()
    app.use(express.json())
    app.use(createDailyRouter({ ...world, now: () => AT.launchDay }))

    expect((await request(app).post('/daily/metrics').send({ event: 'started' })).status).toBe(204)
    expect((await request(app).post('/daily/metrics').send({ event: 'started' })).status).toBe(204)
    expect((await request(app).post('/daily/metrics').send({ event: 'completed' })).status).toBe(
      204,
    )
    expect((await request(app).post('/daily/metrics').send({ event: 'signup' })).status).toBe(204)
    expect((await request(app).post('/daily/metrics').send({ event: 'login' })).status).toBe(204)

    expect(Object.fromEntries(world.metrics.counts)).toEqual({
      '2026-11-01|anon_started': 2,
      '2026-11-01|anon_completed': 1,
      '2026-11-01|origin_signup': 1,
      '2026-11-01|origin_login': 1,
    })
  })

  it('recusa evento desconhecido e campo extra (nada de identificador no corpo)', async () => {
    const world = buildDailyWorld({ startDate: START })
    const app = express()
    app.use(express.json())
    app.use(createDailyRouter({ ...world, now: () => AT.launchDay }))

    for (const body of [{}, { event: 'x' }, { event: 'started', userId: 'u1' }]) {
      expect((await request(app).post('/daily/metrics').send(body)).status).toBe(400)
    }
    expect(world.metrics.counts.size).toBe(0)
  })

  it('o contador usa o dia UTC: 21h de Brasília já conta no dia seguinte', async () => {
    const world = buildDailyWorld({ startDate: START })
    const app = express()
    app.use(express.json())
    app.use(createDailyRouter({ ...world, now: () => AT.brasilia2100 }))

    await request(app).post('/daily/metrics').send({ event: 'started' })

    expect([...world.metrics.counts.keys()]).toEqual(['2026-11-03|anon_started'])
  })
})
