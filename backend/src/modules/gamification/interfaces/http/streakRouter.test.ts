import express from 'express'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import { createAuthMiddleware } from '../../../../shared/http/authMiddleware'
import { createFakeTokenIssuer } from '../../../auth/test/fakes/fakeTokenIssuer'
import { GetProgressionUseCase } from '../../application/useCases/getProgression'
import { TouchStreakUseCase } from '../../application/useCases/touchStreak'
import { createFakeProgressionRepository } from '../../test/fakes/fakeProgressionRepository'
import { createStreakRouter } from './streakRouter'

function buildApp() {
  const progressionRepository = createFakeProgressionRepository()
  const tokenIssuer = createFakeTokenIssuer()
  const authMiddleware = createAuthMiddleware(tokenIssuer)
  const getProgression = new GetProgressionUseCase(progressionRepository)
  const touchStreak = new TouchStreakUseCase(progressionRepository)

  const app = express()
  app.use(express.json())
  app.use(createStreakRouter({ getProgression, authMiddleware }))
  return { app, tokenIssuer, touchStreak }
}

describe('streak routes', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'segredo-de-teste'
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-24T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('GET /me/streak retorna 401 sem token', async () => {
    const { app } = buildApp()

    const res = await request(app).get('/me/streak')

    expect(res.status).toBe(401)
  })

  it('GET /me/streak retorna current_streak/longest_streak zerados sem nenhuma atividade', async () => {
    const { app, tokenIssuer } = buildApp()
    const token = tokenIssuer.issue({ sub: 'u1', role: 'user' })

    const res = await request(app).get('/me/streak').set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ currentStreak: 0, longestStreak: 0 })
  })

  it('GET /me/streak reflete o streak depois de uma atividade qualificada', async () => {
    const { app, tokenIssuer, touchStreak } = buildApp()
    await touchStreak.execute({ userId: 'u1' })
    const token = tokenIssuer.issue({ sub: 'u1', role: 'user' })

    const res = await request(app).get('/me/streak').set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ currentStreak: 1, longestStreak: 1 })
  })
})
