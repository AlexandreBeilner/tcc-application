import express from 'express'
import request from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import { createAuthMiddleware } from '../../../../shared/http/authMiddleware'
import { jsonErrorHandler } from '../../../../shared/http/errorHandler'
import { createFakeTokenIssuer } from '../../../auth/test/fakes/fakeTokenIssuer'
import { AssemblyKindRegistry } from '../../application/assemblyKinds'
import { CreateAssemblyUseCase } from '../../application/useCases/createAssembly'
import { GetAssemblyUseCase } from '../../application/useCases/getAssembly'
import { ListAssembliesUseCase } from '../../application/useCases/listAssemblies'
import { GovernanceEngineUnavailableError } from '../../domain/errors'
import { SHAREHOLDER_KIND, shareholderPolicies } from '../../domain/shareholderPolicies'
import { createFakeAssemblyRepository } from '../../test/fakes/fakeAssemblyRepository'
import { createAssemblyReadsRouter } from './assemblyReadsRouter'

const ANA = '11111111-1111-4111-8111-111111111111'
const NOW = new Date()
const DAY = 24 * 60 * 60 * 1000

async function buildApp(options: { engineDown?: boolean } = {}) {
  const kinds = new AssemblyKindRegistry().register(SHAREHOLDER_KIND, {
    policies: shareholderPolicies,
    effect: { apply: async () => undefined },
  })
  const repository = createFakeAssemblyRepository()
  const { assembly } = await new CreateAssemblyUseCase(kinds, repository).execute({
    kind: SHAREHOLDER_KIND,
    subjectRef: 'company',
    dedupeKey: 'k',
    snapshotAt: new Date(NOW.getTime() - 1000),
    opensAt: new Date(NOW.getTime() - 1000),
    closesAt: new Date(NOW.getTime() + 7 * DAY),
    effectAppliesAt: new Date(NOW.getTime() + 8 * DAY),
    title: 'Pauta',
    options: [
      { key: 'a', label: 'A', gain: 'g', loss: 'l', effect: {} },
      { key: 'b', label: 'B', gain: 'g', loss: 'l', effect: {} },
    ],
  })
  await repository.markOpen(assembly.id)
  const holdings = { takenAt: NOW, holdings: [{ userId: ANA, quantity: 5 }] }
  const tokenIssuer = createFakeTokenIssuer()
  const app = express()
  app.use(
    createAssemblyReadsRouter({
      listAssemblies: new ListAssembliesUseCase(repository),
      getAssembly: new GetAssemblyUseCase(
        kinds,
        repository,
        {
          take: async () => holdings,
          get: async () => {
            if (options.engineDown) throw new GovernanceEngineUnavailableError('motor fora do ar')
            return holdings
          },
        },
        { listActive: async () => [] },
        { get: async () => null, set: async () => undefined },
        () => 3,
      ),
      authMiddleware: createAuthMiddleware(tokenIssuer),
    }),
  )
  app.use(jsonErrorHandler)
  return { app, id: assembly.id, auth: `Bearer ${tokenIssuer.issue({ sub: ANA, role: 'user' })}` }
}

describe('rotas de leitura de assembleias', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'segredo-de-teste'
  })

  it('401 sem token', async () => {
    const { app, id } = await buildApp()
    expect((await request(app).get('/assemblies')).status).toBe(401)
    expect((await request(app).get(`/assemblies/${id}`)).status).toBe(401)
  })

  it('lista abertas e encerradas e valida a query', async () => {
    const { app, auth } = await buildApp()
    const res = await request(app).get('/assemblies').set('Authorization', auth)
    expect(res.status).toBe(200)
    expect(res.body.open).toHaveLength(1)
    expect(res.body.open[0]).toMatchObject({ title: 'Pauta', status: 'open' })
    expect(res.body.closed).toEqual([])
    expect((await request(app).get('/assemblies?status=x').set('Authorization', auth)).status).toBe(
      400,
    )
    expect(
      (await request(app).get('/assemblies?companyId=abc').set('Authorization', auth)).status,
    ).toBe(400)
    expect(
      (await request(app).get('/assemblies?limit=500').set('Authorization', auth)).status,
    ).toBe(400)
  })

  it('detalhe com ficha e placar; 404 e 400 nos erros', async () => {
    const { app, id, auth } = await buildApp()
    const res = await request(app).get(`/assemblies/${id}`).set('Authorization', auth)
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      assembly: { id, status: 'open' },
      scoreboard: { voters: 0 },
      result: null,
      minVoters: 3,
    })
    expect(res.body.options).toHaveLength(2)
    expect(
      (
        await request(app)
          .get('/assemblies/99999999-9999-4999-8999-999999999999')
          .set('Authorization', auth)
      ).status,
    ).toBe(404)
    expect((await request(app).get('/assemblies/abc').set('Authorization', auth)).status).toBe(400)
  })

  it('motor fora do ar: o detalhe responde 503 com o motivo, nunca 500', async () => {
    const { app, id, auth } = await buildApp({ engineDown: true })
    const res = await request(app).get(`/assemblies/${id}`).set('Authorization', auth)
    expect(res.status).toBe(503)
    expect(res.body.reason).toBe('engine_unavailable')
  })
})
