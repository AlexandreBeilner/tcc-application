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
import { createFakeFriendGraphReader } from '../../test/fakes/fakeFriendGraphReader'
import { createFakeLevelReader } from '../../test/fakes/fakeLevelReader'
import { createFakeSandboxAssetReader } from '../../test/fakes/fakeSandboxAssetReader'
import { createFakeUserDirectory } from '../../test/fakes/fakeUserDirectory'
import { createRankingRouter } from './rankingRouter'

function buildApp() {
  const userDirectory = createFakeUserDirectory([
    { id: 'u1', username: 'alice', createdAt: new Date('2026-01-01T00:00:00Z') },
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
      // investedCost/variableIncomeValue (tarefa T.1): os R$10.000 do
      // depósito inicial foram inteiramente investidos e hoje valem
      // R$11.000 — baseline (replay do único evento, initial_deposit) tem
      // investedCost 0 (nenhuma compra no extrato do fake), então o
      // retorno da janela é só o ganho de agora sobre o capital investido
      // agora: (11000 - 10000)/10000 * 100 = 10%.
      u1: {
        cash: 0,
        variableIncomeValue: 11000,
        fixedIncomeValue: 0,
        tradesExecuted: 0,
        total: 11000,
        investedCost: 10000,
        disinvestedProceeds: 0,
        dividendsReceived: 0,
      },
    }),
  )
  const getRanking = new GetRankingUseCase(
    userDirectory,
    createFakeSandboxAssetReader(),
    getNetWorth,
    createFakeLevelReader({ u1: { level: 2, xp: 250 } }),
    createFakeFriendGraphReader(),
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
      scope: 'global',
      criterion: 'overall',
      entries: [
        {
          userId: 'u1',
          username: 'alice',
          level: 2,
          xp: 250,
          profitabilityPct: 10,
          cosmetics: { frame: null, title: null },
        },
      ],
      requestingUserPosition: 1,
      page: 1,
      pageSize: 25,
      totalEntries: 1,
      totalPages: 1,
      updatedAt: null,
    })
  })

  it('GET /ranking?scope=friends usa o escopo Amigos (default é global)', async () => {
    const { app, tokenIssuer } = buildApp()
    const token = tokenIssuer.issue({ sub: 'u1', role: 'user' })

    const res = await request(app)
      .get('/ranking?window=week&scope=friends')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.scope).toBe('friends')
    // Sem amigos aceitos, só o próprio usuário aparece.
    expect(res.body.entries).toEqual([
      {
        userId: 'u1',
        username: 'alice',
        level: 2,
        xp: 250,
        profitabilityPct: 10,
        cosmetics: { frame: null, title: null },
      },
    ])
  })

  it('GET /ranking?criterion=level dispensa window e ordena por xp', async () => {
    const { app, tokenIssuer } = buildApp()
    const token = tokenIssuer.issue({ sub: 'u1', role: 'user' })

    const res = await request(app)
      .get('/ranking?criterion=level')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.window).toBeNull()
    expect(res.body.entries).toEqual([
      {
        userId: 'u1',
        username: 'alice',
        level: 2,
        xp: 250,
        profitabilityPct: null,
        cosmetics: { frame: null, title: null },
      },
    ])
  })

  it('GET /ranking?criterion=inválido retorna 400', async () => {
    const { app, tokenIssuer } = buildApp()
    const token = tokenIssuer.issue({ sub: 'u1', role: 'user' })

    const res = await request(app)
      .get('/ranking?window=week&criterion=xp')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(400)
  })
})
