import express from 'express'
import request from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import { createAuthMiddleware } from '../../../../shared/http/authMiddleware'
import { jsonErrorHandler } from '../../../../shared/http/errorHandler'
import { createFakeTokenIssuer } from '../../../auth/test/fakes/fakeTokenIssuer'
import { AssemblyKindRegistry } from '../../application/assemblyKinds'
import { CastVoteUseCase } from '../../application/useCases/castVote'
import { CreateAssemblyUseCase } from '../../application/useCases/createAssembly'
import { GetMyVotingStatusUseCase } from '../../application/useCases/getMyVotingStatus'
import { VoteAccessService } from '../../application/voteAccessService'
import { DEFAULT_ASSEMBLY_PARAMS } from '../../domain/assembly'
import { SHAREHOLDER_KIND, shareholderPolicies } from '../../domain/shareholderPolicies'
import { createFakeAssemblyRepository } from '../../test/fakes/fakeAssemblyRepository'
import { createAssembliesRouter } from './assembliesRouter'

const ANA = '11111111-1111-4111-8111-111111111111'
const ZECA = '33333333-3333-4333-8333-333333333333'
const NOW = new Date()
const DAY = 24 * 60 * 60 * 1000

async function buildApp() {
  const kinds = new AssemblyKindRegistry().register(SHAREHOLDER_KIND, {
    policies: shareholderPolicies,
    effect: { apply: async () => undefined },
  })
  const repository = createFakeAssemblyRepository()
  const holdings = { takenAt: NOW, holdings: [{ userId: ANA, quantity: 12 }] }
  const params = () => DEFAULT_ASSEMBLY_PARAMS
  const access = new VoteAccessService(
    kinds,
    repository,
    { take: async () => holdings, get: async () => holdings },
    { isPro: async () => false },
    { get: async () => ({ level: 3, emailVerified: true }) },
    params,
  )
  const { assembly, options } = await new CreateAssemblyUseCase(kinds, repository).execute({
    kind: SHAREHOLDER_KIND,
    subjectRef: 'company',
    dedupeKey: 'k',
    snapshotAt: new Date(NOW.getTime() - 1000),
    opensAt: new Date(NOW.getTime() - 1000),
    closesAt: new Date(NOW.getTime() + 7 * DAY),
    effectAppliesAt: new Date(NOW.getTime() + 8 * DAY),
    options: [
      { key: 'a', label: 'A', gain: 'g', loss: 'l', effect: {} },
      { key: 'b', label: 'B', gain: 'g', loss: 'l', effect: {} },
    ],
  })
  await repository.markOpen(assembly.id)
  const tokenIssuer = createFakeTokenIssuer()
  const app = express()
  app.use(express.json())
  app.use(
    createAssembliesRouter({
      castVote: new CastVoteUseCase(access, repository, params),
      getMyVotingStatus: new GetMyVotingStatusUseCase(access, params),
      authMiddleware: createAuthMiddleware(tokenIssuer),
    }),
  )
  app.use(jsonErrorHandler)
  const as = (id: string) => `Bearer ${tokenIssuer.issue({ sub: id, role: 'user' })}`
  return { app, as, id: assembly.id, a: options[0].id, b: options[1].id }
}

describe('rotas /assemblies', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'segredo-de-teste'
  })

  it('401 sem token', async () => {
    const { app, id } = await buildApp()
    expect((await request(app).get(`/assemblies/${id}/me`)).status).toBe(401)
    expect((await request(app).post(`/assemblies/${id}/vote`).send({})).status).toBe(401)
  })

  it('400 para id que não é UUID e para corpo inválido', async () => {
    const { app, as, id } = await buildApp()
    expect(
      (await request(app).get('/assemblies/abc/me').set('Authorization', as(ANA))).status,
    ).toBe(400)
    const bad = await request(app)
      .post(`/assemblies/${id}/vote`)
      .set('Authorization', as(ANA))
      .send({ optionId: 'x' })
    expect(bad.status).toBe(400)
    expect(bad.body.error).toBe('corpo inválido')
  })

  it('201 no primeiro voto, 200 ao trocar, sem segundo crédito', async () => {
    const { app, as, id, a, b } = await buildApp()
    const first = await request(app)
      .post(`/assemblies/${id}/vote`)
      .set('Authorization', as(ANA))
      .send({ optionId: a })
    expect(first.status).toBe(201)
    expect(first.body).toEqual({ optionId: a, changed: false, creditConsumed: true })
    const second = await request(app)
      .post(`/assemblies/${id}/vote`)
      .set('Authorization', as(ANA))
      .send({ optionId: b })
    expect(second.status).toBe(200)
    expect(second.body).toEqual({ optionId: b, changed: true, creditConsumed: false })
  })

  it('403 com o motivo quando não tinha posição, 404 e 400 para os demais erros', async () => {
    const { app, as, id, a } = await buildApp()
    const denied = await request(app)
      .post(`/assemblies/${id}/vote`)
      .set('Authorization', as(ZECA))
      .send({ optionId: a })
    expect(denied.status).toBe(403)
    expect(denied.body.reason).toBe('not_shareholder')
    const missing = await request(app)
      .post('/assemblies/99999999-9999-4999-8999-999999999999/vote')
      .set('Authorization', as(ANA))
      .send({ optionId: a })
    expect(missing.status).toBe(404)
    const foreign = await request(app)
      .post(`/assemblies/${id}/vote`)
      .set('Authorization', as(ANA))
      .send({ optionId: '99999999-9999-4999-8999-999999999999' })
    expect(foreign.status).toBe(400)
  })

  it('GET /me devolve a situação da própria pessoa', async () => {
    const { app, as, id, a } = await buildApp()
    const before = await request(app).get(`/assemblies/${id}/me`).set('Authorization', as(ANA))
    expect(before.status).toBe(200)
    expect(before.body).toMatchObject({
      canVote: true,
      myShares: 12,
      myVote: null,
      credit: { available: 1, minLevel: 3 },
    })
    await request(app)
      .post(`/assemblies/${id}/vote`)
      .set('Authorization', as(ANA))
      .send({ optionId: a })
    const after = await request(app).get(`/assemblies/${id}/me`).set('Authorization', as(ANA))
    expect(after.body).toMatchObject({ myVote: { optionId: a }, credit: { used: 1, available: 0 } })
    const other = await request(app).get(`/assemblies/${id}/me`).set('Authorization', as(ZECA))
    expect(other.body).toMatchObject({ canVote: false, reason: 'not_shareholder', myVote: null })
  })
})
