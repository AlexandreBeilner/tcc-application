import express from 'express'
import { describe, expect, it } from 'vitest'
import request from 'supertest'
import { createAuthMiddleware } from '../../../../shared/http/authMiddleware'
import { createFakeTokenIssuer } from '../../../auth/test/fakes/fakeTokenIssuer'
import { GetAdminOverviewUseCase } from '../../application/useCases/getAdminOverview'
import { GetSystemHealthUseCase } from '../../application/useCases/getSystemHealth'
import { createFakeMarketOverviewReader } from '../../test/fakes/fakeMarketOverviewReader'
import { createFakeSchedulerAdmin } from '../../test/fakes/fakeSchedulerAdmin'
import { createFakeUserStatsReader } from '../../test/fakes/fakeUserStatsReader'
import { createAdminSystemRouter } from './adminSystemRouter'

function buildApp() {
  const tokenIssuer = createFakeTokenIssuer()
  const market = createFakeMarketOverviewReader()
  const ok = { check: async () => {} }
  const app = express()
  app.use(
    createAdminSystemRouter({
      getSystemHealth: new GetSystemHealthUseCase({
        engine: ok,
        gamification_db: ok,
        market_db: ok,
        redis: {
          check: async () => {
            throw new Error('redis fora')
          },
        },
      }),
      getAdminOverview: new GetAdminOverviewUseCase(
        market,
        createFakeSchedulerAdmin(),
        createFakeUserStatsReader(),
      ),
      authMiddleware: createAuthMiddleware(tokenIssuer),
    }),
  )
  const adminToken = () => `Bearer ${tokenIssuer.issue({ sub: 'admin-1', role: 'admin' })}`
  const userToken = () => `Bearer ${tokenIssuer.issue({ sub: 'user-1', role: 'user' })}`
  return { app, market, adminToken, userToken }
}

describe.each(['/admin/system/health', '/admin/overview'])('GET %s', (path) => {
  it('401 sem token', async () => {
    const { app } = buildApp()
    expect((await request(app).get(path)).status).toBe(401)
  })

  it('403 para quem não é admin', async () => {
    const { app, userToken } = buildApp()
    expect((await request(app).get(path).set('Authorization', userToken())).status).toBe(403)
  })
})

describe('GET /admin/system/health', () => {
  it('devolve a saúde de cada componente, com o que está fora marcado', async () => {
    const { app, adminToken } = buildApp()
    const res = await request(app).get('/admin/system/health').set('Authorization', adminToken())

    expect(res.status).toBe(200)
    const byKey = Object.fromEntries(res.body.components.map((c: { key: string }) => [c.key, c]))
    expect(byKey.backend.status).toBe('ok')
    expect(byKey.redis).toMatchObject({ status: 'fora', detail: 'redis fora' })
  })
})

describe('GET /admin/overview', () => {
  it('devolve o resumo do painel', async () => {
    const { app, adminToken } = buildApp()
    const res = await request(app).get('/admin/overview').set('Authorization', adminToken())

    expect(res.status).toBe(200)
    expect(res.body.market.simulated_day).toBe(120)
    expect(res.body.users.total).toBe(42)
    expect(res.body.errors).toEqual({})
  })

  it('segue com 200 quando o motor está fora', async () => {
    const { app, market, adminToken } = buildApp()
    market.errorToThrow = new Error('motor fora')
    const res = await request(app).get('/admin/overview').set('Authorization', adminToken())

    expect(res.status).toBe(200)
    expect(res.body.market).toBeNull()
    expect(res.body.errors.market).toBe('motor fora')
    expect(res.body.users.total).toBe(42)
  })
})
