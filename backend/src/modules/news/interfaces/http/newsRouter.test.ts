import express from 'express'
import { describe, expect, it } from 'vitest'
import request from 'supertest'
import { createAuthMiddleware } from '../../../../shared/http/authMiddleware'
import { createFakeTokenIssuer } from '../../../auth/test/fakes/fakeTokenIssuer'
import { ListNewsFeedUseCase } from '../../application/useCases/listNewsFeed'
import { createFakeNewsFeedReader } from '../../test/fakes/fakeNewsFeedReader'
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
}

function buildApp(newsFeedReader = createFakeNewsFeedReader({ events: [sampleEvent] })) {
  const tokenIssuer = createFakeTokenIssuer()
  const authMiddleware = createAuthMiddleware(tokenIssuer)
  const listNewsFeed = new ListNewsFeedUseCase(newsFeedReader)
  const app = express()
  app.use(express.json())
  app.use(createNewsRouter({ listNewsFeed, authMiddleware }))
  return { app, tokenIssuer, newsFeedReader }
}

describe('GET /news', () => {
  it('retorna 401 sem token', async () => {
    const { app } = buildApp()
    const res = await request(app).get('/news')
    expect(res.status).toBe(401)
  })

  it('retorna 200 pra usuário comum (não exige role admin)', async () => {
    const { app, tokenIssuer } = buildApp()
    const token = tokenIssuer.issue({ sub: 'user-1', role: 'user' })

    const res = await request(app).get('/news').set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ events: [sampleEvent] })
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
