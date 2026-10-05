import express from 'express'
import { describe, expect, it } from 'vitest'
import request from 'supertest'
import { createAuthMiddleware } from '../../../../shared/http/authMiddleware'
import { createFakeTokenIssuer } from '../../../auth/test/fakes/fakeTokenIssuer'
import { GetMarketMonitorAssetUseCase } from '../../application/useCases/getMarketMonitorAsset'
import { ListMarketMonitorUseCase } from '../../application/useCases/listMarketMonitor'
import {
  createFakeMarketMonitorReader,
  sampleMonitorAsset,
  sampleMonitorDetail,
} from '../../test/fakes/fakeMarketMonitorReader'
import { createAdminMarketRouter } from './adminMarketRouter'

function buildApp() {
  const tokenIssuer = createFakeTokenIssuer()
  const monitor = createFakeMarketMonitorReader()
  const app = express()
  app.use(
    createAdminMarketRouter({
      listMarketMonitor: new ListMarketMonitorUseCase(monitor),
      getMarketMonitorAsset: new GetMarketMonitorAssetUseCase(monitor),
      authMiddleware: createAuthMiddleware(tokenIssuer),
    }),
  )
  const adminToken = () => `Bearer ${tokenIssuer.issue({ sub: 'admin-1', role: 'admin' })}`
  const userToken = () => `Bearer ${tokenIssuer.issue({ sub: 'user-1', role: 'user' })}`
  return { app, monitor, adminToken, userToken }
}

const assetPath = `/admin/market/assets/${sampleMonitorAsset.asset_id}`

describe.each(['/admin/market/assets', assetPath])('GET %s', (path) => {
  it('401 sem token', async () => {
    const { app } = buildApp()
    expect((await request(app).get(path)).status).toBe(401)
  })

  it('403 para quem não é admin', async () => {
    const { app, userToken } = buildApp()
    expect((await request(app).get(path).set('Authorization', userToken())).status).toBe(403)
  })
})

describe('GET /admin/market/assets', () => {
  it('lista os ativos do monitor', async () => {
    const { app, adminToken } = buildApp()
    const res = await request(app).get('/admin/market/assets').set('Authorization', adminToken())

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ assets: [sampleMonitorAsset] })
  })
})

describe('GET /admin/market/assets/:id', () => {
  it('devolve o detalhe com book, negócios e séries', async () => {
    const { app, monitor, adminToken } = buildApp()
    const res = await request(app).get(assetPath).set('Authorization', adminToken())

    expect(res.status).toBe(200)
    expect(res.body).toEqual(sampleMonitorDetail)
    expect(monitor.askedIds).toEqual([sampleMonitorAsset.asset_id])
  })

  it('400 quando o id não é UUID, sem chamar o motor', async () => {
    const { app, monitor, adminToken } = buildApp()
    const res = await request(app)
      .get('/admin/market/assets/nao-uuid')
      .set('Authorization', adminToken())

    expect(res.status).toBe(400)
    expect(monitor.askedIds).toEqual([])
  })

  it('404 quando o ativo não existe', async () => {
    const { app, adminToken } = buildApp()
    const res = await request(app)
      .get('/admin/market/assets/22222222-2222-4222-8222-222222222222')
      .set('Authorization', adminToken())

    expect(res.status).toBe(404)
    expect(res.body.error).toBe('ativo não encontrado')
  })
})
