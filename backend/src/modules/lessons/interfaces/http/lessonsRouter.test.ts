import express from 'express'
import { beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createAuthMiddleware } from '../../../../shared/http/authMiddleware'
import { createFakeTokenIssuer } from '../../../auth/test/fakes/fakeTokenIssuer'
import { AdvanceLessonUseCase } from '../../application/useCases/advanceLesson'
import { GetLessonUseCase } from '../../application/useCases/getLesson'
import { GetTrackMapUseCase } from '../../application/useCases/getTrackMap'
import { LESSON_UNLOCK_STEP } from '../../domain/lesson'
import { createFakeLessonRepository } from '../../test/fakes/fakeLessonRepository'
import { createFakeStreakTracker } from '../../test/fakes/fakeStreakTracker'
import { createFakeXpAwarder } from '../../test/fakes/fakeXpAwarder'
import { createLessonsRouter } from './lessonsRouter'

const lessons = [1, 2].map((n) => ({
  id: `l${n}`,
  code: `0.${n}`,
  title: `Lição 0.${n}`,
  trackNumber: 0,
  trackName: 'Trilha 0 — Fundamentos',
  sortOrder: n,
  centralConcept: 'x',
  unlocksDescription: null,
}))

function buildApp() {
  const lessonRepository = createFakeLessonRepository(lessons)
  const tokenIssuer = createFakeTokenIssuer()
  const authMiddleware = createAuthMiddleware(tokenIssuer)
  const getTrackMap = new GetTrackMapUseCase(lessonRepository)
  const getLesson = new GetLessonUseCase(lessonRepository)
  const advanceLesson = new AdvanceLessonUseCase(
    lessonRepository,
    createFakeXpAwarder(),
    createFakeStreakTracker(),
  )

  const app = express()
  app.use(express.json())
  app.use(createLessonsRouter({ getTrackMap, getLesson, advanceLesson, authMiddleware }))
  return { app, tokenIssuer }
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

  it('POST /lessons/:id/progress retorna 400 pra step inválido', async () => {
    const { app, tokenIssuer } = buildApp()

    const res = await request(app)
      .post('/lessons/l1/progress')
      .set('Authorization', authHeader(tokenIssuer))
      .send({ step: 99 })

    expect(res.status).toBe(400)
  })

  it('POST /lessons/:id/progress avança e conclui a lição no step de desbloqueio', async () => {
    const { app, tokenIssuer } = buildApp()

    const res = await request(app)
      .post('/lessons/l1/progress')
      .set('Authorization', authHeader(tokenIssuer))
      .send({ step: LESSON_UNLOCK_STEP })

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ currentStep: LESSON_UNLOCK_STEP, completed: true })
  })

  it('POST /lessons/:id/progress retorna 404 pra lição bloqueada', async () => {
    const { app, tokenIssuer } = buildApp()

    const res = await request(app)
      .post('/lessons/l2/progress')
      .set('Authorization', authHeader(tokenIssuer))
      .send({ step: 0 })

    expect(res.status).toBe(404)
  })
})
