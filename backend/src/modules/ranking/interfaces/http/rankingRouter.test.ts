import express from 'express'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import { createAuthMiddleware } from '../../../../shared/http/authMiddleware'
import { createFakeTokenIssuer } from '../../../auth/test/fakes/fakeTokenIssuer'
import { GetNetWorthUseCase } from '../../application/useCases/getNetWorth'
import { GetRankingUseCase } from '../../application/useCases/getRanking'
import { createFakeAccountEventsReader } from '../../test/fakes/fakeAccountEventsReader'
import { createFakeAssetPriceHistoryReader } from '../../test/fakes/fakeAssetPriceHistoryReader'
import { createFakeCurrentAccountStateReader } from '../../test/fakes/fakeCurrentAccountStateReader'
import { createFakeSandboxAssetReader } from '../../test/fakes/fakeSandboxAssetReader'
import { createFakeUserDirectory } from '../../test/fakes/fakeUserDirectory'
import { createRankingRouter } from './rankingRouter'

function buildApp() {
  const userDirectory = createFakeUserDirectory([
    { id: 'u1', createdAt: new Date('2026-01-01T00:00:00Z') },
  ])
  const getNetWorth = new GetNetWorthUseCase(
    createFakeAccountEventsReader({
      u1: [
        {
          id: '1',
          eventType: 'initial_deposit',
          unitValue: 10000,
          timestamp: new Date('2026-01-01T00:00:00Z'),
        },
      ],
    }),
    createFakeAssetPriceHistoryReader(),
    createFakeCurrentAccountStateReader({
      u1: {
        cash: 11000,
        variableIncomeValue: 0,
        fixedIncomeValue: 0,
        tradesExecuted: 0,
        total: 11000,
      },
    }),
  )
  const getRanking = new GetRankingUseCase(
    userDirectory,
    createFakeSandboxAssetReader(),
    getNetWorth,
  )
  const tokenIssuer = createFakeTokenIssuer()
  const authMiddleware = createAuthMiddleware(tokenIssuer)

  const app = express()
  app.use(express.json())
  app.use(createRankingRouter({ getRanking, authMiddleware }))
  return { app, tokenIssuer }
}

describe('ranking routes', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'segredo-de-teste'
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-26T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('GET /ranking retorna 401 sem token', async () => {
    const { app } = buildApp()

    const res = await request(app).get('/ranking?window=week')

    expect(res.status).toBe(401)
  })

  it('GET /ranking retorna 400 sem window ou com valor inválido', async () => {
    const { app, tokenIssuer } = buildApp()
    const token = tokenIssuer.issue({ sub: 'u1', role: 'user' })

    const missing = await request(app).get('/ranking').set('Authorization', `Bearer ${token}`)
    expect(missing.status).toBe(400)

    const invalid = await request(app)
      .get('/ranking?window=year')
      .set('Authorization', `Bearer ${token}`)
    expect(invalid.status).toBe(400)
  })

  it('GET /ranking?window=week retorna a lista ordenada e a posição do usuário logado', async () => {
    const { app, tokenIssuer } = buildApp()
    const token = tokenIssuer.issue({ sub: 'u1', role: 'user' })

    const res = await request(app)
      .get('/ranking?window=week')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      window: 'week',
      entries: [{ userId: 'u1', profitabilityPct: 10 }],
      requestingUserPosition: 1,
    })
  })
})
