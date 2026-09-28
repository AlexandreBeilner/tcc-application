import express from 'express'
import { beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createAuthMiddleware } from '../../../../shared/http/authMiddleware'
import { createFakeTokenIssuer } from '../../../auth/test/fakes/fakeTokenIssuer'
import { CompleteMissionUseCase } from '../../application/useCases/completeMission'
import { ListDailyMissionsUseCase } from '../../application/useCases/listDailyMissions'
import {
  MICRO_DECISION_STREAK_MISSION_KEY,
  REVIEW_OLD_LESSON_MISSION_KEY,
} from '../../domain/mission'
import { createFakeLessonCompletionChecker } from '../../test/fakes/fakeLessonCompletionChecker'
import { createFakeLessonReviewChecker } from '../../test/fakes/fakeLessonReviewChecker'
import { createFakeMicroDecisionStreakChecker } from '../../test/fakes/fakeMicroDecisionStreakChecker'
import { createFakeMissionRepository } from '../../test/fakes/fakeMissionRepository'
import { createFakeStreakTracker } from '../../test/fakes/fakeStreakTracker'
import { createFakeXpAwarder } from '../../test/fakes/fakeXpAwarder'
import { createMissionsRouter } from './missionsRouter'

const catalog = [
  {
    id: 'm1',
    key: 'lesson_complete',
    title: 'Complete uma lição da trilha',
    description: null,
    completionCriteria: 'Concluir qualquer lição hoje',
    xpReward: 30,
    requiresLessonCompletion: true,
  },
  {
    id: 'm2',
    key: 'feed_read',
    title: 'Consulte o feed de notícias',
    description: null,
    completionCriteria: 'Abrir o feed de notícias',
    xpReward: 20,
    requiresLessonCompletion: false,
  },
  {
    id: 'm3',
    key: REVIEW_OLD_LESSON_MISSION_KEY,
    title: 'Revise uma lição concluída há mais de 14 dias',
    description: null,
    completionCriteria: 'Reabrir e revisar hoje uma lição antiga',
    xpReward: 30,
    requiresLessonCompletion: false,
  },
  {
    id: 'm4',
    key: MICRO_DECISION_STREAK_MISSION_KEY,
    title: 'Acerte 3 apostas seguidas hoje',
    description: null,
    completionCriteria: '3 acertos seguidos hoje na Micro-decisão',
    xpReward: 30,
    requiresLessonCompletion: false,
  },
]

function buildApp(
  hasCompletedLesson = false,
  hasReviewedOldLesson = false,
  hasMicroDecisionStreak = false,
) {
  const missionRepository = createFakeMissionRepository(catalog)
  const tokenIssuer = createFakeTokenIssuer()
  const authMiddleware = createAuthMiddleware(tokenIssuer)
  const listDailyMissions = new ListDailyMissionsUseCase(missionRepository)
  const completeMission = new CompleteMissionUseCase(
    missionRepository,
    createFakeLessonCompletionChecker(hasCompletedLesson),
    createFakeLessonReviewChecker(hasReviewedOldLesson),
    createFakeMicroDecisionStreakChecker(hasMicroDecisionStreak),
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
    expect(res.body.missions).toHaveLength(4)
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
    expect(res.body).toEqual({
      status: 'completed',
      xpAwarded: 30,
      leveledUp: false,
      newLevel: 1,
      streakMilestone: null,
      unlockedAchievements: [],
    })
  })

  it('POST /missions/:id/complete retorna 422 pra missão de revisão sem revisão elegível hoje', async () => {
    const { app, tokenIssuer } = buildApp(false, false)
    const token = tokenIssuer.issue({ sub: 'u1', role: 'user' })

    const res = await request(app)
      .post('/missions/m3/complete')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(422)
  })

  it('POST /missions/:id/complete completa a missão de revisão quando revisou uma lição antiga hoje', async () => {
    const { app, tokenIssuer } = buildApp(false, true)
    const token = tokenIssuer.issue({ sub: 'u1', role: 'user' })

    const res = await request(app)
      .post('/missions/m3/complete')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      status: 'completed',
      xpAwarded: 30,
      leveledUp: false,
      newLevel: 1,
      streakMilestone: null,
      unlockedAchievements: [],
    })
  })

  it('POST /missions/:id/complete retorna 422 pra missão de sequência sem a sequência de hoje', async () => {
    const { app, tokenIssuer } = buildApp(false, false, false)
    const token = tokenIssuer.issue({ sub: 'u1', role: 'user' })

    const res = await request(app)
      .post('/missions/m4/complete')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(422)
  })

  it('POST /missions/:id/complete completa a missão de sequência quando a sequência de hoje foi alcançada', async () => {
    const { app, tokenIssuer } = buildApp(false, false, true)
    const token = tokenIssuer.issue({ sub: 'u1', role: 'user' })

    const res = await request(app)
      .post('/missions/m4/complete')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      status: 'completed',
      xpAwarded: 30,
      leveledUp: false,
      newLevel: 1,
      streakMilestone: null,
      unlockedAchievements: [],
    })
  })
})
