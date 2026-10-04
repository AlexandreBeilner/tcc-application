import express from 'express'
import { beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createAuthMiddleware } from '../../../../shared/http/authMiddleware'
import { createFakeTokenIssuer } from '../../../auth/test/fakes/fakeTokenIssuer'
import { AnswerMicroDecisionUseCase } from '../../application/useCases/answerMicroDecision'
import { AdvanceLessonUseCase } from '../../application/useCases/advanceLesson'
import { GetLessonUseCase } from '../../application/useCases/getLesson'
import { GetTrackMapUseCase } from '../../application/useCases/getTrackMap'
import { ReviewLessonUseCase } from '../../application/useCases/reviewLesson'
import { LESSON_UNLOCK_STEP, LESSON_XP_REWARD } from '../../domain/lesson'
import { createFakeAchievementChecker } from '../../test/fakes/fakeAchievementChecker'
import { createFakeLessonRepository } from '../../test/fakes/fakeLessonRepository'
import { createFakeSocialFeedRecorder } from '../../test/fakes/fakeSocialFeedRecorder'
import { createFakeStreakTracker } from '../../test/fakes/fakeStreakTracker'
import { createFakeXpAwarder } from '../../test/fakes/fakeXpAwarder'
import { createLessonsRouter } from './lessonsRouter'

const lessons = [1, 2].map((n) => ({
  id: `l${n}`,
  code: `0.${n}`,
  title: `Lição 0.${n}`,
  trackNumber: 0,
  trackName: 'Trilha 0: Fundamentos',
  sortOrder: n,
  centralConcept: 'x',
  scenarioText: '',
  microDecisionPrompt: '',
  microDecisionType: 'reflection' as const,
  microDecisionAssetTicker: null,
  revelationText: '',
  unlocksDescription: null,
  unlocksKeys: [],
  unlocksAssetTicker: null,
  // l1 ganha opções reais (backlog engajamento B.2) — o único teste que se
  // importa é o de `selectedOption` inválido abaixo; os demais nunca enviam
  // o campo, então o comportamento existente não muda.
  microDecisionOptions: n === 1 ? ['Sim', 'Não'] : null,
  microDecisionCorrectOption: n === 1 ? 0 : null,
}))

// `minStepIntervalMs` 0 por padrão: os testes de rota não são sobre o tempo
// mínimo entre passos (S.4, coberto no caso de uso e no teste dedicado abaixo).
function buildApp(minStepIntervalMs = 0) {
  const lessonRepository = createFakeLessonRepository(lessons)
  const tokenIssuer = createFakeTokenIssuer()
  const authMiddleware = createAuthMiddleware(tokenIssuer)
  const getTrackMap = new GetTrackMapUseCase(lessonRepository)
  const getLesson = new GetLessonUseCase(lessonRepository)
  const advanceLesson = new AdvanceLessonUseCase(
    lessonRepository,
    createFakeXpAwarder(),
    createFakeStreakTracker(),
    createFakeSocialFeedRecorder(),
    { minStepIntervalMs },
  )
  const answerMicroDecision = new AnswerMicroDecisionUseCase(lessonRepository)
  const reviewLesson = new ReviewLessonUseCase(lessonRepository, createFakeAchievementChecker())

  const app = express()
  app.use(express.json())
  app.use(
    createLessonsRouter({
      getTrackMap,
      getLesson,
      advanceLesson,
      answerMicroDecision,
      reviewLesson,
      authMiddleware,
    }),
  )
  return { app, tokenIssuer, lessonRepository }
}

function authHeader(tokenIssuer: ReturnType<typeof createFakeTokenIssuer>) {
  return `Bearer ${tokenIssuer.issue({ sub: 'u1', role: 'user' })}`
}

describe('lessons routes', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'segredo-de-teste'
  })

  it('GET /lessons retorna 401 sem token', async () => {
    const { app } = buildApp()

    const res = await request(app).get('/lessons')

    expect(res.status).toBe(401)
  })

  it('GET /lessons retorna o mapa da trilha com status calculado', async () => {
    const { app, tokenIssuer } = buildApp()

    const res = await request(app).get('/lessons').set('Authorization', authHeader(tokenIssuer))

    expect(res.status).toBe(200)
    expect(res.body.lessons).toHaveLength(2)
    expect(res.body.lessons[0].status).toBe('available')
    expect(res.body.lessons[1].status).toBe('locked')
  })

  it('GET /lessons/:id retorna 404 pra lição bloqueada', async () => {
    const { app, tokenIssuer } = buildApp()

    const res = await request(app).get('/lessons/l2').set('Authorization', authHeader(tokenIssuer))

    expect(res.status).toBe(404)
  })

  it('GET /lessons/:id retorna 404 pra id inexistente', async () => {
    const { app, tokenIssuer } = buildApp()

    const res = await request(app)
      .get('/lessons/nope')
      .set('Authorization', authHeader(tokenIssuer))

    expect(res.status).toBe(404)
  })

  it('GET /lessons/:id retorna a lição disponível', async () => {
    const { app, tokenIssuer } = buildApp()

    const res = await request(app).get('/lessons/l1').set('Authorization', authHeader(tokenIssuer))

    expect(res.status).toBe(200)
    expect(res.body.lesson.status).toBe('available')
  })

  it('GET /lessons/:id nunca devolve microDecisionCorrectOption, nem pra lição com aposta real (correção da revisão da PR 18)', async () => {
    const { app, tokenIssuer } = buildApp()

    const res = await request(app).get('/lessons/l1').set('Authorization', authHeader(tokenIssuer))

    expect(res.body.lesson).not.toHaveProperty('microDecisionCorrectOption')
  })

  it('GET /lessons nunca devolve microDecisionCorrectOption em nenhuma lição do mapa', async () => {
    const { app, tokenIssuer } = buildApp()

    const res = await request(app).get('/lessons').set('Authorization', authHeader(tokenIssuer))

    for (const lesson of res.body.lessons) {
      expect(lesson).not.toHaveProperty('microDecisionCorrectOption')
    }
  })

  it('POST /lessons/:id/progress retorna 400 pra step inválido', async () => {
    const { app, tokenIssuer } = buildApp()

    const res = await request(app)
      .post('/lessons/l1/progress')
      .set('Authorization', authHeader(tokenIssuer))
      .send({ step: 99 })

    expect(res.status).toBe(400)
  })

  it('POST /lessons/:id/progress devolve 422 micro_decision_unsolved ao sair da pergunta sem acertar', async () => {
    const { app, tokenIssuer } = buildApp()
    await request(app)
      .post('/lessons/l1/progress')
      .set('Authorization', authHeader(tokenIssuer))
      .send({ step: 1 })

    const res = await request(app)
      .post('/lessons/l1/progress')
      .set('Authorization', authHeader(tokenIssuer))
      .send({ step: 2 })

    expect(res.status).toBe(422)
    expect(res.body.code).toBe('micro_decision_unsolved')
  })

  it('POST /lessons/:id/progress ignora selectedOption (deprecado): sem veredito e sem gravar', async () => {
    const { app, tokenIssuer, lessonRepository } = buildApp()
    await request(app)
      .post('/lessons/l1/progress')
      .set('Authorization', authHeader(tokenIssuer))
      .send({ step: 1 })

    const res = await request(app)
      .post('/lessons/l1/progress')
      .set('Authorization', authHeader(tokenIssuer))
      .send({ step: 1, selectedOption: 0 })

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ currentStep: 1, completed: false })
    const [progress] = await lessonRepository.listProgressForUser('u1')
    expect(progress.microDecisionSelectedOption).toBeNull()
  })

  it('POST /lessons/:id/answer: erra sem gabarito, acerta com gabarito e libera o avanço; GET nunca expõe o gabarito', async () => {
    const { app, tokenIssuer } = buildApp()
    const auth = authHeader(tokenIssuer)
    await request(app).post('/lessons/l1/progress').set('Authorization', auth).send({ step: 1 })

    const wrong = await request(app)
      .post('/lessons/l1/answer')
      .set('Authorization', auth)
      .send({ selectedOption: 1 })
    expect(wrong.status).toBe(200)
    expect(wrong.body).toEqual({ correct: false, attempts: 1, firstTry: false, wrongOptions: [1] })

    const view = await request(app).get('/lessons/l1').set('Authorization', auth)
    expect(view.body.lesson).toMatchObject({
      microDecisionSolved: false,
      microDecisionWrongOptions: [1],
    })
    expect(JSON.stringify(view.body)).not.toContain('microDecisionCorrectOption')

    const right = await request(app)
      .post('/lessons/l1/answer')
      .set('Authorization', auth)
      .send({ selectedOption: 0 })
    expect(right.body).toMatchObject({ correct: true, attempts: 2, correctOptionLabel: 'Sim' })

    const advance = await request(app)
      .post('/lessons/l1/progress')
      .set('Authorization', auth)
      .send({ step: 2 })
    expect(advance.status).toBe(200)
  })

  it('POST /lessons/:id/answer valida o payload (400), a opção (400), a lição (404) e o passo (422)', async () => {
    const { app, tokenIssuer } = buildApp()
    const auth = authHeader(tokenIssuer)

    expect(
      (await request(app).post('/lessons/l1/answer').set('Authorization', auth).send({})).status,
    ).toBe(400)
    expect(
      (
        await request(app)
          .post('/lessons/nope/answer')
          .set('Authorization', auth)
          .send({ selectedOption: 0 })
      ).status,
    ).toBe(404)
    const early = await request(app)
      .post('/lessons/l1/answer')
      .set('Authorization', auth)
      .send({ selectedOption: 0 })
    expect(early.status).toBe(422)
    expect(early.body.code).toBe('step_out_of_order')

    await request(app).post('/lessons/l1/progress').set('Authorization', auth).send({ step: 1 })
    expect(
      (
        await request(app)
          .post('/lessons/l1/answer')
          .set('Authorization', auth)
          .send({ selectedOption: 9 })
      ).status,
    ).toBe(400)

    const noBet = await request(app)
      .post('/lessons/l2/answer')
      .set('Authorization', auth)
      .send({ selectedOption: 0 })
    expect(noBet.status).toBe(422)
    expect(noBet.body.code).toBe('no_micro_decision')
  })

  it('POST /lessons/:id/answer exige autenticação', async () => {
    const { app } = buildApp()
    expect((await request(app).post('/lessons/l1/answer').send({ selectedOption: 0 })).status).toBe(
      401,
    )
  })

  it('POST /lessons/:id/progress avança e conclui a lição no step de desbloqueio', async () => {
    const { app, tokenIssuer } = buildApp()
    await request(app)
      .post('/lessons/l1/progress')
      .set('Authorization', authHeader(tokenIssuer))
      .send({ step: 1 })
    await request(app)
      .post('/lessons/l1/answer')
      .set('Authorization', authHeader(tokenIssuer))
      .send({ selectedOption: 0 })
    for (const step of [2]) {
      await request(app)
        .post('/lessons/l1/progress')
        .set('Authorization', authHeader(tokenIssuer))
        .send({ step })
    }

    const res = await request(app)
      .post('/lessons/l1/progress')
      .set('Authorization', authHeader(tokenIssuer))
      .send({ step: LESSON_UNLOCK_STEP })

    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      currentStep: LESSON_UNLOCK_STEP,
      completed: true,
      xpAwarded: LESSON_XP_REWARD,
      leveledUp: false,
      newLevel: 1,
      streakMilestone: null,
      unlockedAchievements: [],
    })
  })

  it('POST /lessons/:id/progress retorna 422 step_out_of_order ao pular direto pro desbloqueio', async () => {
    const { app, tokenIssuer } = buildApp()

    const res = await request(app)
      .post('/lessons/l1/progress')
      .set('Authorization', authHeader(tokenIssuer))
      .send({ step: LESSON_UNLOCK_STEP })

    expect(res.status).toBe(422)
    expect(res.body).toMatchObject({ code: 'step_out_of_order' })
  })

  it('POST /lessons/:id/progress retorna 422 step_too_fast com retryAfterMs ao avançar sem esperar', async () => {
    const { app, tokenIssuer } = buildApp(60_000)
    await request(app)
      .post('/lessons/l1/progress')
      .set('Authorization', authHeader(tokenIssuer))
      .send({ step: 1 })

    const res = await request(app)
      .post('/lessons/l1/progress')
      .set('Authorization', authHeader(tokenIssuer))
      .send({ step: 2 })

    expect(res.status).toBe(422)
    expect(res.body).toMatchObject({ code: 'step_too_fast' })
    expect(res.body.retryAfterMs).toBeGreaterThan(0)
  })

  it('POST /lessons/:id/progress retorna 404 pra lição bloqueada', async () => {
    const { app, tokenIssuer } = buildApp()

    const res = await request(app)
      .post('/lessons/l2/progress')
      .set('Authorization', authHeader(tokenIssuer))
      .send({ step: 0 })

    expect(res.status).toBe(404)
  })

  it('POST /lessons/:id/review retorna 422 pra lição ainda não concluída', async () => {
    const { app, tokenIssuer } = buildApp()

    const res = await request(app)
      .post('/lessons/l1/review')
      .set('Authorization', authHeader(tokenIssuer))

    expect(res.status).toBe(422)
  })

  it('POST /lessons/:id/review retorna 404 pra id inexistente', async () => {
    const { app, tokenIssuer } = buildApp()

    const res = await request(app)
      .post('/lessons/nope/review')
      .set('Authorization', authHeader(tokenIssuer))

    expect(res.status).toBe(404)
  })

  it('POST /lessons/:id/review marca a lição concluída como revisada', async () => {
    const { app, tokenIssuer, lessonRepository } = buildApp()
    await lessonRepository.upsertProgress('u1', 'l1', {
      currentStep: LESSON_UNLOCK_STEP,
      completedAt: new Date('2026-08-01T12:00:00Z'),
    })

    const res = await request(app)
      .post('/lessons/l1/review')
      .set('Authorization', authHeader(tokenIssuer))

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ status: 'reviewed', unlockedAchievements: [] })
    const [progress] = await lessonRepository.listProgressForUser('u1')
    expect(progress.lastReviewedAt).not.toBeNull()
  })
})
