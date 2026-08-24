import express from 'express'
import { beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createAuthMiddleware } from '../../../../shared/http/authMiddleware'
import { createFakeTokenIssuer } from '../../../auth/test/fakes/fakeTokenIssuer'
import { AwardXpUseCase } from '../../application/useCases/awardXp'
import { GetProgressionUseCase } from '../../application/useCases/getProgression'
import { createFakeProgressionRepository } from '../../test/fakes/fakeProgressionRepository'
import { createProgressionRouter } from './progressionRouter'

function buildApp() {
  const progressionRepository = createFakeProgressionRepository()
  const tokenIssuer = createFakeTokenIssuer()
  const authMiddleware = createAuthMiddleware(tokenIssuer)
  const getProgression = new GetProgressionUseCase(progressionRepository)
  const awardXp = new AwardXpUseCase(progressionRepository)

  const app = express()
  app.use(express.json())
  app.use(createProgressionRouter({ getProgression, authMiddleware }))
  return { app, tokenIssuer, awardXp }
}

describe('progression routes', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'segredo-de-teste'
  })

  it('GET /me/progression retorna 401 sem token', async () => {
    const { app } = buildApp()

    const res = await request(app).get('/me/progression')

    expect(res.status).toBe(401)
  })

  it('GET /me/progression retorna a progressão do usuário autenticado', async () => {
    const { app, tokenIssuer, awardXp } = buildApp()
    await awardXp.execute({ userId: 'u1', amount: 150, reason: 'licao' })
    const token = tokenIssuer.issue({ sub: 'u1', role: 'user' })

    const res = await request(app).get('/me/progression').set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      userId: 'u1',
      xp: 150,
      level: 2,
      currentStreak: 0,
      longestStreak: 0,
      lastQualifyingActivityDate: null,
    })
  })

  it('GET /users/:id/progression não exige token e nunca inclui patrimônio', async () => {
    const { app, awardXp } = buildApp()
    await awardXp.execute({ userId: 'u2', amount: 50, reason: 'missao' })

    const res = await request(app).get('/users/u2/progression')

    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      userId: 'u2',
      xp: 50,
      level: 1,
      currentStreak: 0,
      longestStreak: 0,
      lastQualifyingActivityDate: null,
    })
    expect(res.body).not.toHaveProperty('netWorth')
    expect(res.body).not.toHaveProperty('balance')
  })
})
