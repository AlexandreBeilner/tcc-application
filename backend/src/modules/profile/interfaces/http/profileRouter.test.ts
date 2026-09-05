import express from 'express'
import { beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createAuthMiddleware } from '../../../../shared/http/authMiddleware'
import { createFakeTokenIssuer } from '../../../auth/test/fakes/fakeTokenIssuer'
import { GetPublicProfileUseCase } from '../../application/useCases/getPublicProfile'
import { createFakeAchievementsReader } from '../../test/fakes/fakeAchievementsReader'
import { createFakeGamificationReader } from '../../test/fakes/fakeGamificationReader'
import { createFakeProfitabilityReader } from '../../test/fakes/fakeProfitabilityReader'
import { createFakeUserDirectory } from '../../test/fakes/fakeUserDirectory'
import { createProfileRouter } from './profileRouter'

const user = {
  id: 'u1',
  username: 'alice',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  avatarPath: null,
}

function buildApp() {
  const userDirectory = createFakeUserDirectory([user])
  const gamificationReader = createFakeGamificationReader({
    u1: { level: 2, xp: 150, currentStreak: 3 },
  })
  const achievementsReader = createFakeAchievementsReader()
  const profitabilityReader = createFakeProfitabilityReader({ u1: 4.2 })
  const getPublicProfile = new GetPublicProfileUseCase(
    userDirectory,
    gamificationReader,
    achievementsReader,
    profitabilityReader,
  )
  const tokenIssuer = createFakeTokenIssuer()
  const authMiddleware = createAuthMiddleware(tokenIssuer)

  const app = express()
  app.use(express.json())
  app.use(createProfileRouter({ getPublicProfile, authMiddleware }))
  return { app, tokenIssuer }
}

describe('profile routes', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'segredo-de-teste'
  })

  it('GET /users/:id/profile retorna 401 sem token', async () => {
    const { app } = buildApp()

    const res = await request(app).get('/users/u1/profile')

    expect(res.status).toBe(401)
  })

  it('GET /users/:id/profile retorna o perfil público de outro usuário', async () => {
    const { app, tokenIssuer } = buildApp()
    const token = tokenIssuer.issue({ sub: 'someone-else', role: 'user' })

    const res = await request(app).get('/users/u1/profile').set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.profile).toMatchObject({ username: 'alice', level: 2, profitabilityPct: 4.2 })
  })

  it('GET /users/:id/profile retorna 404 pra id inexistente', async () => {
    const { app, tokenIssuer } = buildApp()
    const token = tokenIssuer.issue({ sub: 'u1', role: 'user' })

    const res = await request(app)
      .get('/users/nope/profile')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(404)
  })

  it('GET /users/:id/profile aceita ?window=month', async () => {
    const { app, tokenIssuer } = buildApp()
    const token = tokenIssuer.issue({ sub: 'u1', role: 'user' })

    const res = await request(app)
      .get('/users/u1/profile?window=month')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.profile.window).toBe('month')
  })

  it('GET /me/profile retorna o perfil do próprio usuário autenticado', async () => {
    const { app, tokenIssuer } = buildApp()
    const token = tokenIssuer.issue({ sub: 'u1', role: 'user' })

    const res = await request(app).get('/me/profile').set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.profile.username).toBe('alice')
  })
})
