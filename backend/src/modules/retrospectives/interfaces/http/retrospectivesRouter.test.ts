import express from 'express'
import request from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import { createAuthMiddleware } from '../../../../shared/http/authMiddleware'
import { jsonErrorHandler } from '../../../../shared/http/errorHandler'
import { createFakeTokenIssuer } from '../../../auth/test/fakes/fakeTokenIssuer'
import {
  GenerateRetrospectiveUseCase,
  GetRetrospectiveUseCase,
  ListRetrospectiveMonthsUseCase,
} from '../../application/useCases/getRetrospective'
import { createFakeActivity, createFakeRepository, createFakeReturns } from '../../test/fakes/fakes'
import { createRetrospectivesRouter } from './retrospectivesRouter'

function buildApp() {
  const activity = createFakeActivity({ ana: new Date('2026-07-15T00:00:00Z') })
  const generate = new GenerateRetrospectiveUseCase(
    activity,
    createFakeReturns({ ana: 4.2 }),
    createFakeRepository(),
  )
  const list = new ListRetrospectiveMonthsUseCase(activity, () => new Date('2026-10-10T12:00:00Z'))
  const tokenIssuer = createFakeTokenIssuer()
  const app = express()
  app.use(express.json())
  app.use(
    createRetrospectivesRouter({
      listMonths: list,
      getRetrospective: new GetRetrospectiveUseCase(generate, list),
      authMiddleware: createAuthMiddleware(tokenIssuer),
    }),
  )
  app.use(jsonErrorHandler)
  return { app, auth: `Bearer ${tokenIssuer.issue({ sub: 'ana', role: 'user' })}` }
}

describe('rotas /retrospectives', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'segredo-de-teste'
  })

  it('401 sem token', async () => {
    const { app } = buildApp()
    expect((await request(app).get('/retrospectives')).status).toBe(401)
    expect((await request(app).get('/retrospectives/2026-09')).status).toBe(401)
  })

  it('lista os meses disponíveis, mais recentes primeiro', async () => {
    const { app, auth } = buildApp()
    const res = await request(app).get('/retrospectives').set('Authorization', auth)
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ months: ['2026-09', '2026-08', '2026-07'] })
  })

  it('devolve a retrospectiva completa do mês, sem patrimônio', async () => {
    const { app, auth } = buildApp()
    const res = await request(app).get('/retrospectives/2026-09').set('Authorization', auth)
    expect(res.status).toBe(200)
    expect(res.body.retrospective).toMatchObject({
      lessonsCompleted: 6,
      longestStreak: 3,
      bestReturnPct: 4.2,
    })
    expect(JSON.stringify(res.body)).not.toMatch(/patrim/)
  })

  it('mês inexistente, aberto ou mal formado responde 404 (nunca vaza dado)', async () => {
    const { app, auth } = buildApp()
    for (const month of ['2026-10', '2026-06', 'abc', '2026-13']) {
      expect(
        (await request(app).get(`/retrospectives/${month}`).set('Authorization', auth)).status,
      ).toBe(404)
    }
  })
})
