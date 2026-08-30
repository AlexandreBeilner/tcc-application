import express from 'express'
import { describe, expect, it } from 'vitest'
import request from 'supertest'
import { createAuthMiddleware } from '../../../../shared/http/authMiddleware'
import { createFakeTokenIssuer } from '../../../auth/test/fakes/fakeTokenIssuer'
import { ListNewsFeedUseCase } from '../../application/useCases/listNewsFeed'
import { MarkNewsEventAsSeenUseCase } from '../../application/useCases/markNewsEventAsSeen'
import { createFakeNewsFeedReader } from '../../test/fakes/fakeNewsFeedReader'
import { createFakeNewsReadRepository } from '../../test/fakes/fakeNewsReadRepository'
import { createNewsRouter } from './newsRouter'

const sampleEvent = {
  id: 'event-1',
  title: 'título',
  narrative: 'narrativa',
  direction: 'negativo',
  magnitude_band: 'moderado',
  affects_price: true,
  affects_fundamentals: true,
  status: 'pendente',
  triggered_on_day: 10,
  duration_days: 2,
  targets: [{ sector: 'Financeiro' }],
  created_at: '2026-08-30T14:05:00.000Z',
}

function buildApp(
  newsFeedReader = createFakeNewsFeedReader({ events: [sampleEvent] }),
  newsReadRepository = createFakeNewsReadRepository(),
) {
  const tokenIssuer = createFakeTokenIssuer()
  const authMiddleware = createAuthMiddleware(tokenIssuer)
  const listNewsFeed = new ListNewsFeedUseCase(newsFeedReader, newsReadRepository)
  const markNewsEventAsSeen = new MarkNewsEventAsSeenUseCase(newsReadRepository)
  const app = express()
  app.use(express.json())
  app.use(createNewsRouter({ listNewsFeed, markNewsEventAsSeen, authMiddleware }))
  return { app, tokenIssuer, newsFeedReader, newsReadRepository }
}

describe('GET /news', () => {
  it('retorna 401 sem token', async () => {
    const { app } = buildApp()
    const res = await request(app).get('/news')
    expect(res.status).toBe(401)
  })

  it('retorna 200 pra usuário comum (não exige role admin), com seen decorado', async () => {
    const { app, tokenIssuer } = buildApp()
    const token = tokenIssuer.issue({ sub: 'user-1', role: 'user' })

    const res = await request(app).get('/news').set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ events: [{ ...sampleEvent, seen: false }] })
  })

  it('repassa limit/offset da query pro motor', async () => {
    const { app, tokenIssuer, newsFeedReader } = buildApp()
    const token = tokenIssuer.issue({ sub: 'user-1', role: 'user' })

    const res = await request(app)
      .get('/news?limit=5&offset=10')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(newsFeedReader.calls).toEqual([{ limit: 5, offset: 10 }])
  })

  it('retorna 400 para limit/offset inválidos', async () => {
    const { app, tokenIssuer } = buildApp()
    const token = tokenIssuer.issue({ sub: 'user-1', role: 'user' })

    const res = await request(app).get('/news?limit=0').set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(400)
  })
})

describe('POST /news/:id/seen', () => {
  it('retorna 401 sem token', async () => {
    const { app } = buildApp()
    const res = await request(app).post('/news/event-1/seen')
    expect(res.status).toBe(401)
  })

  it('marca o evento como visto e retorna 204', async () => {
    const { app, tokenIssuer, newsReadRepository } = buildApp()
    const token = tokenIssuer.issue({ sub: 'user-1', role: 'user' })

    const res = await request(app)
      .post('/news/event-1/seen')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(204)
    expect(newsReadRepository.markCalls).toEqual([{ userId: 'user-1', macroEventId: 'event-1' }])
  })

  it('idempotente — reenviar continua 204 sem duplicar', async () => {
    const { app, tokenIssuer, newsReadRepository } = buildApp()
    const token = tokenIssuer.issue({ sub: 'user-1', role: 'user' })

    await request(app).post('/news/event-1/seen').set('Authorization', `Bearer ${token}`)
    const res = await request(app)
      .post('/news/event-1/seen')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(204)
    expect(newsReadRepository.markCalls).toHaveLength(2)
    expect(newsReadRepository.seen.size).toBe(1)
  })
})
