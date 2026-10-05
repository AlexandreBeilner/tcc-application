import express from 'express'
import { describe, expect, it } from 'vitest'
import request from 'supertest'
import { createAuthMiddleware } from '../../../../shared/http/authMiddleware'
import { createFakeTokenIssuer } from '../../../auth/test/fakes/fakeTokenIssuer'
import { CatalogAssetNotFoundError, CatalogAssetRejectedError } from '../../domain/errors'
import { ListAdminCatalogUseCase } from '../../application/useCases/listAdminCatalog'
import { RecordAdminActionUseCase } from '../../application/useCases/recordAdminAction'
import { UpdateCatalogAssetUseCase } from '../../application/useCases/updateCatalogAsset'
import { createFakeAuditLogRepository } from '../../test/fakes/fakeAuditLogRepository'
import { createFakeCatalogAdmin, sampleCatalogAsset } from '../../test/fakes/fakeCatalogAdmin'
import { createAdminCatalogRouter } from './adminCatalogRouter'

const ASSET = sampleCatalogAsset.asset_id

function buildApp() {
  const tokenIssuer = createFakeTokenIssuer()
  const authMiddleware = createAuthMiddleware(tokenIssuer)
  const catalogAdmin = createFakeCatalogAdmin()
  const auditLog = createFakeAuditLogRepository()
  const app = express()
  app.use(express.json())
  app.use(
    createAdminCatalogRouter({
      listAdminCatalog: new ListAdminCatalogUseCase(catalogAdmin),
      updateCatalogAsset: new UpdateCatalogAssetUseCase(
        catalogAdmin,
        new RecordAdminActionUseCase(auditLog),
      ),
      authMiddleware,
    }),
  )
  const adminToken = () => `Bearer ${tokenIssuer.issue({ sub: 'admin-1', role: 'admin' })}`
  const userToken = () => `Bearer ${tokenIssuer.issue({ sub: 'user-1', role: 'user' })}`
  return { app, catalogAdmin, auditLog, adminToken, userToken }
}

const routes: Array<[string, 'get' | 'patch', string, object?]> = [
  ['GET /admin/catalog', 'get', '/admin/catalog'],
  ['PATCH /admin/catalog/:id', 'patch', `/admin/catalog/${ASSET}`, { name: 'Novo' }],
]

describe('rotas admin do catálogo (N.12)', () => {
  it.each(routes)('%s retorna 401 sem token', async (_n, method, path, body) => {
    const { app } = buildApp()
    expect((await request(app)[method](path).send(body)).status).toBe(401)
  })

  it.each(routes)(
    '%s retorna 403 para usuário comum, sem chamar o motor nem auditar',
    async (_n, method, path, body) => {
      const { app, userToken, catalogAdmin, auditLog } = buildApp()
      const res = await request(app)[method](path).set('Authorization', userToken()).send(body)
      expect(res.status).toBe(403)
      expect(catalogAdmin.calls).toHaveLength(0)
      expect(auditLog.entries).toHaveLength(0)
    },
  )

  it('GET devolve o catálogo', async () => {
    const { app, adminToken } = buildApp()
    const res = await request(app).get('/admin/catalog').set('Authorization', adminToken())
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ assets: [sampleCatalogAsset] })
  })

  it('PATCH grava com o admin do token e audita', async () => {
    const { app, adminToken, catalogAdmin, auditLog } = buildApp()
    const res = await request(app)
      .patch(`/admin/catalog/${ASSET}`)
      .set('Authorization', adminToken())
      .send({ name: 'Acme Brasil', quality_multiplier: 1.2 })
    expect(res.status).toBe(200)
    expect(res.body.name).toBe('Acme Brasil')
    expect(catalogAdmin.updates).toEqual([
      {
        assetId: ASSET,
        patch: { name: 'Acme Brasil', quality_multiplier: 1.2 },
        adminId: 'admin-1',
      },
    ])
    expect(auditLog.entries[0]).toMatchObject({ action: 'catalog.update', result: 'success' })
  })

  it.each([
    {},
    { ticker: 'NOVO3' },
    { outstanding_shares: 5 },
    { report_frequency_days: 30 },
    { name: 5 },
    { base_growth_pct: 'alto' },
  ])('PATCH com corpo %j retorna 400 sem chamar o motor', async (body) => {
    const { app, adminToken, catalogAdmin, auditLog } = buildApp()
    const res = await request(app)
      .patch(`/admin/catalog/${ASSET}`)
      .set('Authorization', adminToken())
      .send(body)
    expect(res.status).toBe(400)
    expect(catalogAdmin.calls).toHaveLength(0)
    expect(auditLog.entries).toHaveLength(0)
  })

  it('PATCH com id que não é UUID retorna 400', async () => {
    const { app, adminToken, catalogAdmin } = buildApp()
    const res = await request(app)
      .patch('/admin/catalog/abc')
      .set('Authorization', adminToken())
      .send({ name: 'x' })
    expect(res.status).toBe(400)
    expect(catalogAdmin.calls).toHaveLength(0)
  })

  it('PATCH traduz 404 e 422 do motor e audita a falha', async () => {
    const { app, adminToken, catalogAdmin, auditLog } = buildApp()
    catalogAdmin.errorToThrow = new CatalogAssetNotFoundError('ativo não encontrado')
    const notFound = await request(app)
      .patch(`/admin/catalog/${ASSET}`)
      .set('Authorization', adminToken())
      .send({ name: 'x' })
    expect(notFound.status).toBe(404)

    catalogAdmin.errorToThrow = new CatalogAssetRejectedError('multiplicador fora da faixa')
    const rejected = await request(app)
      .patch(`/admin/catalog/${ASSET}`)
      .set('Authorization', adminToken())
      .send({ quality_multiplier: 9 })
    expect(rejected.status).toBe(422)
    expect(rejected.body.error).toBe('multiplicador fora da faixa')
    expect(auditLog.entries.map((e) => e.result)).toEqual(['failed', 'failed'])
  })
})
