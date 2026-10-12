import express from 'express'
import request from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import { createAuthMiddleware } from '../../../../shared/http/authMiddleware'
import { jsonErrorHandler } from '../../../../shared/http/errorHandler'
import { createFakeTokenIssuer } from '../../../auth/test/fakes/fakeTokenIssuer'
import { EquipCosmeticUseCase } from '../../application/useCases/equipCosmetic'
import { ListMyCosmeticsUseCase } from '../../application/useCases/listMyCosmetics'
import { UnequipCosmeticUseCase } from '../../application/useCases/unequipCosmetic'
import {
  createFakeCatalog,
  createFakeMembership,
  createFakeProAccess,
  createFakeSelections,
} from '../../test/fakes/fakes'
import { createCosmeticsRouter } from './cosmeticsRouter'

function buildApp() {
  const selections = createFakeSelections()
  const membership = createFakeMembership(['pro'])
  const access = createFakeProAccess(['pro'])
  const catalog = createFakeCatalog()
  const tokenIssuer = createFakeTokenIssuer()
  const app = express()
  app.use(express.json())
  app.use(
    createCosmeticsRouter({
      listMyCosmetics: new ListMyCosmeticsUseCase(catalog, selections, membership),
      equipCosmetic: new EquipCosmeticUseCase(access, catalog, selections),
      unequipCosmetic: new UnequipCosmeticUseCase(selections),
      authMiddleware: createAuthMiddleware(tokenIssuer),
    }),
  )
  app.use(jsonErrorHandler)
  const auth = (id: string) => `Bearer ${tokenIssuer.issue({ sub: id, role: 'user' })}`
  return { app, auth, selections }
}

describe('rotas /me/cosmetics', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'segredo-de-teste'
  })

  it('401 sem token', async () => {
    const { app } = buildApp()
    expect((await request(app).get('/me/cosmetics')).status).toBe(401)
    expect((await request(app).put('/me/cosmetics').send({})).status).toBe(401)
    expect((await request(app).delete('/me/cosmetics?kind=frame')).status).toBe(401)
  })

  it('GET mostra catálogo e escolha, sem exigir PRO', async () => {
    const { app, auth } = buildApp()
    const res = await request(app).get('/me/cosmetics').set('Authorization', auth('free'))
    expect(res.status).toBe(200)
    expect(res.body.isPro).toBe(false)
    expect(res.body.catalog).toHaveLength(3)
  })

  it('PUT equipa e devolve o estado novo', async () => {
    const { app, auth } = buildApp()
    const res = await request(app)
      .put('/me/cosmetics')
      .set('Authorization', auth('pro'))
      .send({ kind: 'frame', itemKey: 'frame_aurora' })
    expect(res.status).toBe(200)
    expect(res.body.selection.frame).toBe('frame_aurora')
    expect(res.body.display).toEqual({ isPro: true, frame: 'frame_aurora', title: null })
  })

  it('PUT sem PRO responde 403 requer plano PRO (nunca 404)', async () => {
    const { app, auth, selections } = buildApp()
    const res = await request(app)
      .put('/me/cosmetics')
      .set('Authorization', auth('free'))
      .send({ kind: 'frame', itemKey: 'frame_aurora' })
    expect(res.status).toBe(403)
    expect(res.body).toEqual({ error: 'requer plano PRO' })
    expect(selections.rows.size).toBe(0)
  })

  it('PUT valida o corpo (400) e item desconhecido (404)', async () => {
    const { app, auth } = buildApp()
    const bad = await request(app)
      .put('/me/cosmetics')
      .set('Authorization', auth('pro'))
      .send({ kind: 'tema', itemKey: 'x' })
    expect(bad.status).toBe(400)
    const missing = await request(app)
      .put('/me/cosmetics')
      .set('Authorization', auth('pro'))
      .send({ kind: 'frame', itemKey: 'nao_existe' })
    expect(missing.status).toBe(404)
  })

  it('DELETE tira o item mesmo de quem não é PRO', async () => {
    const { app, auth, selections } = buildApp()
    selections.rows.set('free', { frame: 'frame_aurora', title: null })
    const res = await request(app)
      .delete('/me/cosmetics?kind=frame')
      .set('Authorization', auth('free'))
    expect(res.status).toBe(200)
    expect(res.body.selection.frame).toBeNull()
    expect(
      (await request(app).delete('/me/cosmetics?kind=x').set('Authorization', auth('free'))).status,
    ).toBe(400)
  })
})
