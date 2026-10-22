import express from 'express'
import { beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createAuthMiddleware } from '../../../../shared/http/authMiddleware'
import { createFakeTokenIssuer } from '../../../auth/test/fakes/fakeTokenIssuer'
import type { Achievement } from '../../domain/achievement'
import { ListAchievementsUseCase } from '../../application/useCases/listAchievements'
import { createFakeAchievementRepository } from '../../test/fakes/fakeAchievementRepository'
import { createFakeProgressSnapshotReader } from '../../test/fakes/fakeProgressSnapshotReader'
import { createAchievementsRouter } from './achievementsRouter'

const catalog: Achievement[] = [
  {
    id: 'a-streak-7',
    name: 'Primeira Semana',
    description: null,
    criteriaType: 'streak_days',
    criteriaValue: 7,
    isActive: true,
  },
]

function buildApp() {
  const achievementRepository = createFakeAchievementRepository(catalog)
  const progressSnapshotReader = createFakeProgressSnapshotReader({
    u1: {
      netWorth: 0,
      streakDays: 3,
      lessonsCompleted: 0,
      tradesExecuted: 0,
      microDecisionsStreak: 0,
      tracksCompletedNoErrors: 0,
      lessonsReviewed: 0,
      assembliesParticipated: 0,
      referralsQualified: 0,
      dailyWordFirstTry: 0,
      dailyPerfectDays: 0,
    },
  })
  const tokenIssuer = createFakeTokenIssuer()
  const authMiddleware = createAuthMiddleware(tokenIssuer)
  const listAchievements = new ListAchievementsUseCase(
    achievementRepository,
    progressSnapshotReader,
  )

  const app = express()
  app.use(express.json())
  app.use(createAchievementsRouter({ listAchievements, authMiddleware }))
  return { app, tokenIssuer }
}

describe('achievements routes', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'segredo-de-teste'
  })

  it('GET /achievements retorna 401 sem token', async () => {
    const { app } = buildApp()

    const res = await request(app).get('/achievements')

    expect(res.status).toBe(401)
  })

  it('GET /achievements retorna o catálogo com status e progresso', async () => {
    const { app, tokenIssuer } = buildApp()
    const token = tokenIssuer.issue({ sub: 'u1', role: 'user' })

    const res = await request(app).get('/achievements').set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.achievements).toHaveLength(1)
    expect(res.body.achievements[0]).toMatchObject({
      id: 'a-streak-7',
      unlocked: false,
      progress: 3,
    })
  })
})
