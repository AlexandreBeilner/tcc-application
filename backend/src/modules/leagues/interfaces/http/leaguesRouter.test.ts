import express from 'express'
import request from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import { createAuthMiddleware } from '../../../../shared/http/authMiddleware'
import { jsonErrorHandler } from '../../../../shared/http/errorHandler'
import { createFakeTokenIssuer } from '../../../auth/test/fakes/fakeTokenIssuer'
import { CloseLeagueUseCase } from '../../application/useCases/closeLeague'
import { CreateLeagueUseCase } from '../../application/useCases/createLeague'
import { GetLeagueUseCase } from '../../application/useCases/getLeague'
import { InviteToLeagueUseCase } from '../../application/useCases/inviteToLeague'
import { LeaveLeagueUseCase } from '../../application/useCases/leaveLeague'
import { ListMyLeaguesUseCase } from '../../application/useCases/listMyLeagues'
import { RemoveLeagueMemberUseCase } from '../../application/useCases/removeLeagueMember'
import { RenameLeagueUseCase } from '../../application/useCases/renameLeague'
import { RespondToLeagueInvitationUseCase } from '../../application/useCases/respondToLeagueInvitation'
import { createFakeLeagueRepository } from '../../test/fakes/fakeLeagueRepository'
import { createFakeFriendships, createFakeScores, createFakeUsers } from '../../test/fakes/fakes'
import { createLeaguesRouter } from './leaguesRouter'

const OWNER = '11111111-1111-4111-8111-111111111111'
const FRIEND = '22222222-2222-4222-8222-222222222222'
const STRANGER = '33333333-3333-4333-8333-333333333333'

function buildApp() {
  const repo = createFakeLeagueRepository()
  const users = createFakeUsers([OWNER, FRIEND, STRANGER])
  const tokenIssuer = createFakeTokenIssuer()
  const app = express()
  app.use(express.json())
  app.use(
    createLeaguesRouter({
      createLeague: new CreateLeagueUseCase(repo),
      listMyLeagues: new ListMyLeaguesUseCase(repo, users),
      getLeague: new GetLeagueUseCase(repo, createFakeScores({ [OWNER]: 4, [FRIEND]: 9 }), users),
      renameLeague: new RenameLeagueUseCase(repo),
      closeLeague: new CloseLeagueUseCase(repo),
      inviteToLeague: new InviteToLeagueUseCase(repo, createFakeFriendships([[OWNER, FRIEND]])),
      respondToInvitation: new RespondToLeagueInvitationUseCase(repo),
      leaveLeague: new LeaveLeagueUseCase(repo),
      removeMember: new RemoveLeagueMemberUseCase(repo),
      authMiddleware: createAuthMiddleware(tokenIssuer),
    }),
  )
  app.use(jsonErrorHandler)
  const as = (id: string) => `Bearer ${tokenIssuer.issue({ sub: id, role: 'user' })}`
  return { app, as }
}

describe('rotas /leagues', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'segredo-de-teste'
  })

  it('401 sem token', async () => {
    const { app } = buildApp()
    expect((await request(app).get('/leagues')).status).toBe(401)
    expect((await request(app).post('/leagues').send({})).status).toBe(401)
  })

  it('fluxo completo: criar, convidar, aceitar, classificar', async () => {
    const { app, as } = buildApp()
    const created = await request(app)
      .post('/leagues')
      .set('Authorization', as(OWNER))
      .send({ name: 'Turma TCC', window: 'week' })
    expect(created.status).toBe(201)
    const id = created.body.league.id as string

    expect(
      (
        await request(app)
          .post(`/leagues/${id}/invitations`)
          .set('Authorization', as(OWNER))
          .send({ userId: FRIEND })
      ).status,
    ).toBe(201)

    const pending = await request(app).get('/leagues').set('Authorization', as(FRIEND))
    expect(pending.body.leagues[0]).toMatchObject({ id, status: 'invited', isOwner: false })

    expect(
      (
        await request(app)
          .post(`/leagues/${id}/invitation`)
          .set('Authorization', as(FRIEND))
          .send({ accept: true })
      ).status,
    ).toBe(204)

    const detail = await request(app).get(`/leagues/${id}`).set('Authorization', as(FRIEND))
    expect(detail.status).toBe(200)
    expect(detail.body.standings.map((s: { userId: string }) => s.userId)).toEqual([FRIEND, OWNER])
    expect(JSON.stringify(detail.body)).not.toMatch(/patrim|netWorth|balance/i)
  })

  it('valida corpo (400) e id (400)', async () => {
    const { app, as } = buildApp()
    expect(
      (
        await request(app)
          .post('/leagues')
          .set('Authorization', as(OWNER))
          .send({ name: 'x', window: 'year' })
      ).status,
    ).toBe(400)
    expect(
      (
        await request(app)
          .post('/leagues')
          .set('Authorization', as(OWNER))
          .send({ name: 'ab', window: 'week' })
      ).status,
    ).toBe(400)
    expect(
      (await request(app).get('/leagues/nao-uuid').set('Authorization', as(OWNER))).status,
    ).toBe(400)
  })

  it('mapeia regras: 404 de quem é de fora, 403 de não-dono e de não-amigo, 409 de limite', async () => {
    const { app, as } = buildApp()
    const ids: string[] = []
    for (let i = 0; i < 3; i++) {
      const r = await request(app)
        .post('/leagues')
        .set('Authorization', as(OWNER))
        .send({ name: `Liga ${i}`, window: 'week' })
      ids.push(r.body.league.id)
    }
    expect(
      (
        await request(app)
          .post('/leagues')
          .set('Authorization', as(OWNER))
          .send({ name: 'Quarta', window: 'week' })
      ).status,
    ).toBe(409)
    expect(
      (await request(app).get(`/leagues/${ids[0]}`).set('Authorization', as(STRANGER))).status,
    ).toBe(404)
    expect(
      (
        await request(app)
          .post(`/leagues/${ids[0]}/invitations`)
          .set('Authorization', as(OWNER))
          .send({ userId: STRANGER })
      ).status,
    ).toBe(403)
    expect(
      (await request(app).delete(`/leagues/${ids[0]}`).set('Authorization', as(OWNER))).status,
    ).toBe(204)
    expect(
      (await request(app).get(`/leagues/${ids[0]}`).set('Authorization', as(OWNER))).status,
    ).toBe(404)
  })

  it('sair, remover e renomear', async () => {
    const { app, as } = buildApp()
    const id = (
      await request(app)
        .post('/leagues')
        .set('Authorization', as(OWNER))
        .send({ name: 'Turma', window: 'month' })
    ).body.league.id
    await request(app)
      .post(`/leagues/${id}/invitations`)
      .set('Authorization', as(OWNER))
      .send({ userId: FRIEND })
    await request(app)
      .post(`/leagues/${id}/invitation`)
      .set('Authorization', as(FRIEND))
      .send({ accept: true })

    expect(
      (
        await request(app)
          .patch(`/leagues/${id}`)
          .set('Authorization', as(OWNER))
          .send({ name: 'Nova' })
      ).status,
    ).toBe(204)
    expect(
      (await request(app).post(`/leagues/${id}/leave`).set('Authorization', as(OWNER))).status,
    ).toBe(400)
    expect(
      (
        await request(app)
          .delete(`/leagues/${id}/members/${FRIEND}`)
          .set('Authorization', as(FRIEND))
      ).status,
    ).toBe(403)
    expect(
      (
        await request(app)
          .delete(`/leagues/${id}/members/${FRIEND}`)
          .set('Authorization', as(OWNER))
      ).status,
    ).toBe(204)
    expect(
      (await request(app).post(`/leagues/${id}/leave`).set('Authorization', as(FRIEND))).status,
    ).toBe(404)
  })
})
