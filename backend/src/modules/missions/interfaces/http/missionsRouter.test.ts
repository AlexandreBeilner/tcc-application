import express from 'express'
import { beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createAuthMiddleware } from '../../../../shared/http/authMiddleware'
import { createFakeTokenIssuer } from '../../../auth/test/fakes/fakeTokenIssuer'
import { CompleteMissionUseCase } from '../../application/useCases/completeMission'
import { ListDailyMissionsUseCase } from '../../application/useCases/listDailyMissions'
import { createFakeLessonCompletionChecker } from '../../test/fakes/fakeLessonCompletionChecker'
import { createFakeMissionRepository } from '../../test/fakes/fakeMissionRepository'
import { createFakeStreakTracker } from '../../test/fakes/fakeStreakTracker'
import { createFakeXpAwarder } from '../../test/fakes/fakeXpAwarder'
import { createMissionsRouter } from './missionsRouter'

const catalog = [
  {
    id: 'm1',
    title: 'Complete uma lição da trilha',
    description: null,
    completionCriteria: 'Concluir qualquer lição hoje',
    xpReward: 30,
    requiresLessonCompletion: true,
  },
  {
    id: 'm2',
    title: 'Consulte o feed de notícias',
    description: null,
    completionCriteria: 'Abrir o feed de notícias',
    xpReward: 20,
    requiresLessonCompletion: false,
  },
]

function buildApp(hasCompletedLesson = false) {
  const missionRepository = createFakeMissionRepository(catalog)
  const tokenIssuer = createFakeTokenIssuer()
  const authMiddleware = createAuthMiddleware(tokenIssuer)
  const listDailyMissions = new ListDailyMissionsUseCase(missionRepository)
  const completeMission = new CompleteMissionUseCase(
    missionRepository,
    createFakeLessonCompletionChecker(hasCompletedLesson),
    createFakeXpAwarder(),
    createFakeStreakTracker(),
  )

  const app = express()
  app.use(express.json())
  app.use(createMissionsRouter({ listDailyMissions, completeMission, authMiddleware }))
  return { app, tokenIssuer }
}

describe('missions routes', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'segredo-de-teste'
  })

  it('GET /missions retorna 401 sem token', async () => {
    const { app } = buildApp()

    const res = await request(app).get('/missions')

    expect(res.status).toBe(401)
  })

  it('GET /missions retorna o catálogo de hoje', async () => {
    const { app, tokenIssuer } = buildApp()
    const token = tokenIssuer.issue({ sub: 'u1', role: 'user' })

    const res = await request(app).get('/missions').set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.missions).toHaveLength(2)
  })

  it('POST /missions/:id/complete retorna 404 pra missão inexistente', async () => {
    const { app, tokenIssuer } = buildApp()
    const token = tokenIssuer.issue({ sub: 'u1', role: 'user' })

    const res = await request(app)
      .post('/missions/nope/complete')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(404)
  })

  it('POST /missions/:id/complete retorna 422 pra missão de lição sem lição concluída hoje', async () => {
    const { app, tokenIssuer } = buildApp(false)
    const token = tokenIssuer.issue({ sub: 'u1', role: 'user' })

    const res = await request(app)
      .post('/missions/m1/complete')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(422)
  })

  it('POST /missions/:id/complete completa a missão de lição quando já concluiu uma hoje', async () => {
    const { app, tokenIssuer } = buildApp(true)
    const token = tokenIssuer.issue({ sub: 'u1', role: 'user' })

    const res = await request(app)
      .post('/missions/m1/complete')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ status: 'completed' })
  })
})
