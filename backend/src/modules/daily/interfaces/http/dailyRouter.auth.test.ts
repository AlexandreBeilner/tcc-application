import express from 'express'
import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createDailyRouter } from './dailyRouter'
import { GetDailyQualityUseCase } from '../../application/useCases/getDailyQuality'
import { START, buildDailyWorld } from '../../test/dailyWorld'

// Hoje = jogo #2 (UTC 2026-11-02). A virada para o #3 é 00:00 UTC (21h de Brasília).
const DAY2 = new Date('2026-11-02T15:00:00.000Z')
const DAY2_LAST_MINUTE = new Date('2026-11-02T23:59:00.000Z')
const DAY3_FIRST_MINUTE = new Date('2026-11-03T00:00:00.000Z')

function setup(initial: Date = DAY2) {
  const world = buildDailyWorld({ startDate: START })
  const clock = { now: initial }
  // Cada chamada monta um app novo sobre o mesmo mundo: é "outro aparelho" falando com o mesmo servidor.
  const device = () => {
    const app = express()
    app.use(express.json())
    app.use(createDailyRouter({ ...world, now: () => clock.now }))
    return app
  }
  return { world, clock, device, token: world.tokenFor('u1') }
}

type Ctx = ReturnType<typeof setup>
const auth = (ctx: Ctx, user = 'u1') => ({ Authorization: `Bearer ${ctx.world.tokenFor(user)}` })

const guess = (ctx: Ctx, n: number, word: string, user = 'u1') =>
  request(ctx.device()).post(`/daily/${n}/word/guess`).set(auth(ctx, user)).send({ guess: word })
const trivia = (ctx: Ctx, n: number, choice: number, user = 'u1') =>
  request(ctx.device())
    .post(`/daily/${n}/cards/trivia/answer`)
    .set(auth(ctx, user))
    .send({ choice })
// Joga os dois cartões (DI18); a Pergunta do dia é a última e fecha o jogo.
async function playAll(ctx: Ctx, n: number, { wordRight = true, triviaRight = true } = {}) {
  await guess(ctx, n, wordRight ? 'acoes' : 'carro')
  if (!wordRight) {
    for (let i = 0; i < 5; i++) await guess(ctx, n, 'carro')
  }
  return trivia(ctx, n, triviaRight ? 1 : 0)
}

describe('autenticação opcional', () => {
  it('token inválido é 401, nunca vira anônimo em silêncio', async () => {
    const ctx = setup()
    const res = await request(ctx.device())
      .post('/daily/2/word/guess')
      .set('Authorization', 'Bearer lixo')
      .send({ guess: 'carro' })
    expect(res.status).toBe(401)
    expect(ctx.world.results.items).toHaveLength(0)
  })

  it('anônimo sem attempt é 400 e nada é gravado', async () => {
    const ctx = setup()
    const res = await request(ctx.device()).post('/daily/2/word/guess').send({ guess: 'carro' })
    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: 'attempt_required' })
  })

  it('anônimo não grava nada nem concede XP, mesmo concluindo o jogo', async () => {
    const ctx = setup()
    const app = ctx.device()
    await request(app).post('/daily/2/word/guess').send({ guess: 'acoes', attempt: 1 })
    const last = await request(app).post('/daily/2/cards/trivia/answer').send({ choice: 1 })
    expect(last.body.completion).toBeUndefined()
    expect(ctx.world.results.items).toHaveLength(0)
    expect(ctx.world.xpAwarder.awarded).toHaveLength(0)
  })

  it('/me e /me/stats exigem login', async () => {
    const ctx = setup()
    expect((await request(ctx.device()).get('/daily/2/me')).status).toBe(401)
    expect((await request(ctx.device()).get('/daily/me/stats')).status).toBe(401)
  })
})

describe('jogo logado: palpites', () => {
  it('a tentativa é a gravada; o attempt do corpo é ignorado', async () => {
    const ctx = setup()
    const a = await request(ctx.device())
      .post('/daily/2/word/guess')
      .set(auth(ctx))
      .send({ guess: 'carro', attempt: 6 })
    expect(a.body.attempt).toBe(1)
    expect(a.body.finished).toBe(false)
    expect(a.body.reveal).toBeUndefined()
    expect((await guess(ctx, 2, 'moral')).body.attempt).toBe(2)
  })

  it('palpite inválido ou fora da lista não gasta tentativa nem cria linha', async () => {
    const ctx = setup()
    expect((await guess(ctx, 2, 'xxxxx')).status).toBe(422)
    expect((await guess(ctx, 2, 'amor')).status).toBe(422)
    expect(ctx.world.results.items).toHaveLength(0)
    expect((await guess(ctx, 2, 'carro')).body.attempt).toBe(1)
  })

  it('errar 6 vezes revela a resposta, e um 7º palpite é recusado (409)', async () => {
    const ctx = setup()
    let last = await guess(ctx, 2, 'carro')
    for (let i = 0; i < 5; i++) last = await guess(ctx, 2, 'carro')
    expect(last.body.attempt).toBe(6)
    expect(last.body.reveal.answer).toBe('AÇÕES')
    const seventh = await guess(ctx, 2, 'moral')
    expect(seventh.status).toBe(409)
    expect(seventh.body).toEqual({ error: 'already_answered' })
    expect(ctx.world.results.items[0].wordGuesses).toHaveLength(6)
  })

  it('acertar fecha o cartão e recusa novos palpites', async () => {
    const ctx = setup()
    const hit = await guess(ctx, 2, 'AÇÕES')
    expect(hit.body.solved).toBe(true)
    expect(hit.body.reveal.answer).toBe('AÇÕES')
    expect((await guess(ctx, 2, 'carro')).status).toBe(409)
  })
})

describe('jogo logado: um cartão por vez', () => {
  it('a Pergunta do dia aceita uma tentativa válida; a segunda é 409 e não altera a primeira', async () => {
    const ctx = setup()
    expect((await trivia(ctx, 2, 0)).body.correct).toBe(false)
    const again = await trivia(ctx, 2, 1)
    expect(again.status).toBe(409)
    expect(ctx.world.results.items[0].questionChoice).toBe(0)
  })

  it('resposta inválida não gasta a tentativa do cartão', async () => {
    const ctx = setup()
    expect((await trivia(ctx, 2, 9)).status).toBe(422)
    expect(ctx.world.results.items).toHaveLength(0)
    expect((await trivia(ctx, 2, 1)).status).toBe(200)
  })
})

describe('XP e streak do jogo do dia', () => {
  it.each([
    [true, true, 50],
    [true, false, 35],
    [false, true, 35],
    [false, false, 20],
  ])('palavra=%s pergunta=%s concede %i XP uma vez, com nível e conquistas', async (w, q, xp) => {
    const ctx = setup()
    const last = await playAll(ctx, 2, { wordRight: w, triviaRight: q })
    expect(last.status).toBe(200)
    expect(last.body.completion).toEqual({
      correctCards: [w, q].filter(Boolean).length,
      xpAwarded: xp,
      level: 2,
      leveledUp: true,
      streakMilestone: null,
      unlockedAchievements: [{ id: 'a1', name: 'Primeiro Diário', description: null }, ...[]],
    })
    expect(ctx.world.xpAwarder.awarded).toEqual([{ userId: 'u1', amount: xp, reason: 'diario:2' }])
    expect(ctx.world.streakTracker.touchedUserIds).toEqual(['u1'])
  })

  it('avisa a conclusão uma vez, também no dia anterior sem XP (marco do painel de retenção)', async () => {
    const ctx = setup()
    await playAll(ctx, 2)
    await trivia(ctx, 2, 1)
    await playAll(ctx, 1)
    expect(ctx.world.completedUserIds).toEqual(['u1', 'u1'])
  })

  it('jogo ainda em andamento não avisa conclusão', async () => {
    const ctx = setup()
    await guess(ctx, 2, 'acoes')
    expect(ctx.world.completedUserIds).toEqual([])
  })

  it('o cartão que não fecha o jogo não traz completion', async () => {
    const ctx = setup()
    const a = await guess(ctx, 2, 'acoes')
    expect(a.body.completion).toBeUndefined()
    expect(ctx.world.xpAwarder.awarded).toHaveLength(0)
  })

  it('reenviar o último cartão (outra aba) não concede de novo', async () => {
    const ctx = setup()
    await playAll(ctx, 2)
    expect((await trivia(ctx, 2, 1)).status).toBe(409)
    expect(ctx.world.xpAwarder.awarded).toHaveLength(1)
    expect(ctx.world.streakTracker.touchedUserIds).toHaveLength(1)
  })

  it('duas abas enviando o último cartão ao mesmo tempo: um 200, um 409, um crédito', async () => {
    const ctx = setup()
    await guess(ctx, 2, 'acoes')
    const [a, b] = await Promise.all([trivia(ctx, 2, 1), trivia(ctx, 2, 1)])
    expect([a.status, b.status].sort()).toEqual([200, 409])
    expect(ctx.world.xpAwarder.awarded).toHaveLength(1)
    expect(ctx.world.streakTracker.touchedUserIds).toHaveLength(1)
  })

  it('cada usuário tem o seu jogo e o seu crédito', async () => {
    const ctx = setup()
    await playAll(ctx, 2)
    await guess(ctx, 2, 'acoes', 'u2')
    await trivia(ctx, 2, 1, 'u2')
    expect(ctx.world.xpAwarder.awarded.map((a) => a.userId).sort()).toEqual(['u1', 'u2'])
  })
})

describe('sem XP: dia anterior e depois da virada', () => {
  it('jogo de dia anterior é gravado, conclui com 0 XP e não toca o streak', async () => {
    const ctx = setup()
    const last = await playAll(ctx, 1)
    expect(last.status).toBe(200)
    expect(last.body.completion).toEqual({ correctCards: 2, xpAwarded: 0 })
    expect(ctx.world.xpAwarder.awarded).toHaveLength(0)
    expect(ctx.world.streakTracker.touchedUserIds).toHaveLength(0)
    expect(ctx.world.results.items[0]).toMatchObject({ puzzleNumber: 1, xpAwarded: 0 })
    expect(ctx.world.results.items[0].completedAt).not.toBeNull()
  })

  it('começado no dia e concluído depois da virada (21h de Brasília) não dá XP', async () => {
    const ctx = setup(DAY2_LAST_MINUTE)
    await guess(ctx, 2, 'acoes')
    ctx.clock.now = DAY3_FIRST_MINUTE
    const last = await trivia(ctx, 2, 1)
    expect(last.status).toBe(200)
    expect(last.body.completion).toEqual({ correctCards: 2, xpAwarded: 0 })
    expect(ctx.world.xpAwarder.awarded).toHaveLength(0)
    expect(ctx.world.streakTracker.touchedUserIds).toHaveLength(0)
  })

  it('concluído no último minuto do dia ainda dá XP', async () => {
    const ctx = setup(DAY2_LAST_MINUTE)
    const last = await playAll(ctx, 2)
    expect(last.body.completion.xpAwarded).toBe(50)
  })

  it('jogo perfeito de dia anterior ou fechado depois da virada não conta para as conquistas (DI.6.1)', async () => {
    const ctx = setup()
    const quality = new GetDailyQualityUseCase(ctx.world.results)
    // Jogo #1 é dia anterior; o #2 é aberto no último minuto e fechado depois da virada.
    await playAll(ctx, 1)
    ctx.clock.now = DAY2_LAST_MINUTE
    await guess(ctx, 2, 'acoes')
    ctx.clock.now = DAY3_FIRST_MINUTE
    await trivia(ctx, 2, 1)
    expect(ctx.world.results.items.every((r) => r.completedAt !== null)).toBe(true)
    expect(await quality.execute({ userId: 'u1' })).toEqual({
      wordFirstTryGames: 0,
      perfectDays: 0,
    })
  })

  it('o jogo do dia concluído a tempo conta para as conquistas', async () => {
    const ctx = setup()
    await playAll(ctx, 2)
    expect(await new GetDailyQualityUseCase(ctx.world.results).execute({ userId: 'u1' })).toEqual({
      wordFirstTryGames: 1,
      perfectDays: 1,
    })
  })

  it('o dia seguinte continua 404 para quem está logado', async () => {
    const ctx = setup()
    expect((await guess(ctx, 3, 'acoes')).status).toBe(404)
    expect((await request(ctx.device()).get('/daily/3/me').set(auth(ctx))).status).toBe(404)
    expect(ctx.world.results.items).toHaveLength(0)
  })
})

describe('GET /daily/:number/me', () => {
  const me = (ctx: Ctx, n = 2, user = 'u1') =>
    request(ctx.device()).get(`/daily/${n}/me`).set(auth(ctx, user))

  it('sem jogada tudo vem como não respondido', async () => {
    const res = await me(setup())
    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      number: 2,
      completed: false,
      xpAwarded: 0,
      word: { guesses: [], finished: false, solved: false },
      trivia: { answered: false },
    })
  })

  it('em andamento mostra as cores dos palpites e não revela a resposta', async () => {
    const ctx = setup()
    await guess(ctx, 2, 'carro')
    await trivia(ctx, 2, 0)
    const res = await me(ctx)
    expect(res.body.word).toEqual({
      guesses: [{ guess: 'CARRO', letters: ['present', 'present', 'absent', 'absent', 'present'] }],
      finished: false,
      solved: false,
    })
    expect(res.body.trivia).toMatchObject({
      answered: true,
      choice: 0,
      correct: false,
      correctIndex: 1,
    })
    const raw = JSON.stringify(res.body.word)
    expect(raw).not.toContain('AÇÕES')
    expect(raw).not.toContain('Pedaços')
  })

  it('redesenha o mesmo estado em outro aparelho, com tudo revelado ao fim', async () => {
    const ctx = setup()
    const last = await playAll(ctx, 2)
    expect(last.status).toBe(200)
    const other = await me(ctx)
    expect(other.body.completed).toBe(true)
    expect(other.body.xpAwarded).toBe(50)
    expect(other.body.word.reveal.answer).toBe('AÇÕES')
    expect(other.body.word.solved).toBe(true)
    expect(other.body.trivia).toMatchObject({ answered: true, choice: 1, correct: true })
    expect(other.body).not.toHaveProperty('timeline')
  })

  it('o estado de um usuário não vaza para outro', async () => {
    const ctx = setup()
    await playAll(ctx, 2)
    expect((await me(ctx, 2, 'u2')).body.completed).toBe(false)
  })

  it('funciona para dia anterior', async () => {
    const ctx = setup()
    await playAll(ctx, 1)
    expect((await me(ctx, 1)).body.completed).toBe(true)
  })
})

describe('GET /daily/me/stats', () => {
  it('resume o que foi jogado logado', async () => {
    const ctx = setup()
    await playAll(ctx, 1)
    await playAll(ctx, 2, { triviaRight: false })
    const res = await request(ctx.device()).get('/daily/me/stats').set(auth(ctx))
    expect(res.status).toBe(200)
    expect(res.body).not.toHaveProperty('timeline')
    expect(res.body).toMatchObject({
      games: 2,
      word: { played: 2, correct: 2, accuracy: 100 },
      trivia: { played: 2, correct: 1, accuracy: 50 },
      wordAttempts: { distribution: { '1': 2 }, failed: 0 },
      // Só o jogo #2 foi concluído no próprio dia; o #1 foi jogado depois e não conta.
      currentStreak: 1,
      longestStreak: 1,
    })
  })

  it('usuário sem jogos recebe zeros', async () => {
    const res = await request(setup().device())
      .get('/daily/me/stats')
      .set({ Authorization: `Bearer ${setup().token}` })
    expect(res.status).toBe(200)
    expect(res.body.games).toBe(0)
    expect(res.body.currentStreak).toBe(0)
  })
})
