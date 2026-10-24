import express from 'express'
import request from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import { createAuthMiddleware } from '../../../../shared/http/authMiddleware'
import { jsonErrorHandler } from '../../../../shared/http/errorHandler'
import { createFakeTokenIssuer } from '../../../auth/test/fakes/fakeTokenIssuer'
import { CancelDuelUseCase } from '../../application/useCases/cancelDuel'
import { CreateDuelUseCase } from '../../application/useCases/createDuel'
import { GetDuelUseCase } from '../../application/useCases/getDuel'
import { ListMyDuelsUseCase } from '../../application/useCases/listMyDuels'
import { RespondToDuelUseCase } from '../../application/useCases/respondToDuel'
import { createFakeDuelRepository } from '../../test/fakes/fakeDuelRepository'
import {
  createFakeFriendships,
  createFakePerformance,
  createFakeUsers,
} from '../../test/fakes/fakes'
import { createDuelsRouter } from './duelsRouter'

const ANA = '11111111-1111-4111-8111-111111111111'
const BIA = '22222222-2222-4222-8222-222222222222'
const ZECA = '33333333-3333-4333-8333-333333333333'

function buildApp() {
  const duels = createFakeDuelRepository()
  const users = createFakeUsers([ANA, BIA, ZECA])
  const performance = createFakePerformance({
    [ANA]: { returnPct: 3, operated: true },
    [BIA]: { returnPct: 1, operated: true },
  })
  const tokenIssuer = createFakeTokenIssuer()
  const app = express()
  app.use(express.json())
  app.use(
    createDuelsRouter({
      createDuel: new CreateDuelUseCase(duels, createFakeFriendships([[ANA, BIA]])),
      respondToDuel: new RespondToDuelUseCase(duels),
      cancelDuel: new CancelDuelUseCase(duels),
      listMyDuels: new ListMyDuelsUseCase(duels, users),
      getDuel: new GetDuelUseCase(duels, performance, users),
      authMiddleware: createAuthMiddleware(tokenIssuer),
    }),
  )
  app.use(jsonErrorHandler)
  const as = (id: string) => `Bearer ${tokenIssuer.issue({ sub: id, role: 'user' })}`
  return { app, as }
}

describe('rotas /duels', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'segredo-de-teste'
  })

  it('401 sem token', async () => {
    const { app } = buildApp()
    expect((await request(app).get('/duels')).status).toBe(401)
    expect((await request(app).post('/duels').send({})).status).toBe(401)
  })

  it('fluxo: desafia, o amigo aceita, ambos veem o placar parcial só em percentual', async () => {
    const { app, as } = buildApp()
    const created = await request(app)
      .post('/duels')
      .set('Authorization', as(ANA))
      .send({ opponentId: BIA })
    expect(created.status).toBe(201)
    expect(created.body.duel).toMatchObject({ status: 'pending', role: 'challenger' })
    const id = created.body.duel.id as string

    const inbox = await request(app).get('/duels').set('Authorization', as(BIA))
    expect(inbox.body.duels[0]).toMatchObject({ id, role: 'opponent', status: 'pending' })

    expect(
      (
        await request(app)
          .post(`/duels/${id}/response`)
          .set('Authorization', as(BIA))
          .send({ accept: true })
      ).status,
    ).toBe(204)

    const detail = await request(app).get(`/duels/${id}`).set('Authorization', as(BIA))
    expect(detail.status).toBe(200)
    expect(detail.body.duel).toMatchObject({
      status: 'active',
      you: { returnPct: 1 },
      them: { returnPct: 3 },
    })
    expect(JSON.stringify(detail.body)).not.toMatch(/patrim|netWorth|balance/i)
  })

  it('o desafiado pode recusar', async () => {
    const { app, as } = buildApp()
    const id = (
      await request(app).post('/duels').set('Authorization', as(ANA)).send({ opponentId: BIA })
    ).body.duel.id
    const res = await request(app)
      .post(`/duels/${id}/response`)
      .set('Authorization', as(BIA))
      .send({ accept: false })
    expect(res.status).toBe(204)
  })

  it('valida corpo e id (400) e mapeia regras', async () => {
    const { app, as } = buildApp()
    expect(
      (await request(app).post('/duels').set('Authorization', as(ANA)).send({ opponentId: 'x' }))
        .status,
    ).toBe(400)
    expect((await request(app).get('/duels/nao-uuid').set('Authorization', as(ANA))).status).toBe(
      400,
    )
    expect(
      (await request(app).post('/duels').set('Authorization', as(ANA)).send({ opponentId: ANA }))
        .status,
    ).toBe(400)
    expect(
      (await request(app).post('/duels').set('Authorization', as(ANA)).send({ opponentId: ZECA }))
        .status,
    ).toBe(403)

    const id = (
      await request(app).post('/duels').set('Authorization', as(ANA)).send({ opponentId: BIA })
    ).body.duel.id
    expect(
      (await request(app).post('/duels').set('Authorization', as(ANA)).send({ opponentId: BIA }))
        .status,
    ).toBe(409)
    expect((await request(app).get(`/duels/${id}`).set('Authorization', as(ZECA))).status).toBe(404)
    expect(
      (
        await request(app)
          .post(`/duels/${id}/response`)
          .set('Authorization', as(ANA))
          .send({ accept: true })
      ).status,
    ).toBe(403)
  })

  it('quem desafiou cancela enquanto ninguém aceitou', async () => {
    const { app, as } = buildApp()
    const id = (
      await request(app).post('/duels').set('Authorization', as(ANA)).send({ opponentId: BIA })
    ).body.duel.id
    expect((await request(app).delete(`/duels/${id}`).set('Authorization', as(BIA))).status).toBe(
      403,
    )
    expect((await request(app).delete(`/duels/${id}`).set('Authorization', as(ANA))).status).toBe(
      204,
    )
    expect((await request(app).delete(`/duels/${id}`).set('Authorization', as(ANA))).status).toBe(
      409,
    )
  })
})
