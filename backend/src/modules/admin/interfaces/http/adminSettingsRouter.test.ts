import express from 'express'
import { describe, expect, it } from 'vitest'
import request from 'supertest'
import { createAuthMiddleware } from '../../../../shared/http/authMiddleware'
import { createFakeTokenIssuer } from '../../../auth/test/fakes/fakeTokenIssuer'
import { EngineSettingNotFoundError, EngineSettingRejectedError } from '../../domain/errors'
import { ListEngineSettingsUseCase } from '../../application/useCases/listEngineSettings'
import { RecordAdminActionUseCase } from '../../application/useCases/recordAdminAction'
import { ResetEngineSettingUseCase } from '../../application/useCases/resetEngineSetting'
import { UpdateEngineSettingUseCase } from '../../application/useCases/updateEngineSetting'
import { createFakeAuditLogRepository } from '../../test/fakes/fakeAuditLogRepository'
import {
  createFakeEngineSettingsAdmin,
  sampleSettings,
} from '../../test/fakes/fakeEngineSettingsAdmin'
import { createAdminSettingsRouter } from './adminSettingsRouter'

function buildApp() {
  const tokenIssuer = createFakeTokenIssuer()
  const authMiddleware = createAuthMiddleware(tokenIssuer)
  const engineSettingsAdmin = createFakeEngineSettingsAdmin()
  const auditLog = createFakeAuditLogRepository()
  const record = new RecordAdminActionUseCase(auditLog)
  const app = express()
  app.use(express.json())
  app.use(
    createAdminSettingsRouter({
      listEngineSettings: new ListEngineSettingsUseCase(engineSettingsAdmin),
      updateEngineSetting: new UpdateEngineSettingUseCase(engineSettingsAdmin, record),
      resetEngineSetting: new ResetEngineSettingUseCase(engineSettingsAdmin, record),
      authMiddleware,
    }),
  )
  const adminToken = () => `Bearer ${tokenIssuer.issue({ sub: 'admin-1', role: 'admin' })}`
  const userToken = () => `Bearer ${tokenIssuer.issue({ sub: 'user-1', role: 'user' })}`
  return { app, engineSettingsAdmin, auditLog, adminToken, userToken }
}

const routes: Array<[string, 'get' | 'put' | 'delete', string, object?]> = [
  ['GET /admin/settings', 'get', '/admin/settings'],
  ['PUT /admin/settings/:key', 'put', '/admin/settings/ticks_per_day', { value: 5 }],
  ['DELETE /admin/settings/:key', 'delete', '/admin/settings/ticks_per_day'],
]

describe('rotas admin de parâmetros de simulação (N.7)', () => {
  it.each(routes)('%s retorna 401 sem token', async (_n, method, path, body) => {
    const { app } = buildApp()
    expect((await request(app)[method](path).send(body)).status).toBe(401)
  })

  it.each(routes)(
    '%s retorna 403 para usuário comum, sem chamar o motor nem auditar',
    async (_n, method, path, body) => {
      const { app, userToken, engineSettingsAdmin, auditLog } = buildApp()
      const res = await request(app)[method](path).set('Authorization', userToken()).send(body)
      expect(res.status).toBe(403)
      expect(engineSettingsAdmin.calls).toHaveLength(0)
      expect(auditLog.entries).toHaveLength(0)
    },
  )

  it('GET devolve editáveis e somente leitura', async () => {
    const { app, adminToken } = buildApp()
    const res = await request(app).get('/admin/settings').set('Authorization', adminToken())
    expect(res.status).toBe(200)
    expect(res.body).toEqual(sampleSettings)
  })

  it('GET sem grupo pede o ritmo; com ?group=governance pede a governança das assembleias', async () => {
    const { app, adminToken, engineSettingsAdmin } = buildApp()
    await request(app).get('/admin/settings').set('Authorization', adminToken())
    await request(app).get('/admin/settings?group=governance').set('Authorization', adminToken())
    expect(engineSettingsAdmin.listGroups).toEqual([undefined, 'governance'])
  })

  it('GET com grupo desconhecido retorna 400 sem chamar o motor', async () => {
    const { app, adminToken, engineSettingsAdmin } = buildApp()
    const res = await request(app)
      .get('/admin/settings?group=outro')
      .set('Authorization', adminToken())
    expect(res.status).toBe(400)
    expect(engineSettingsAdmin.calls).toHaveLength(0)
  })

  it('PUT de um parâmetro de governança grava e audita como settings.update', async () => {
    const { app, adminToken, engineSettingsAdmin, auditLog } = buildApp()
    const res = await request(app)
      .put('/admin/settings/governance_cooldown_days')
      .set('Authorization', adminToken())
      .send({ value: 60 })
    expect(res.status).toBe(200)
    expect(engineSettingsAdmin.saved).toEqual([
      { key: 'governance_cooldown_days', value: 60, adminId: 'admin-1' },
    ])
    expect(auditLog.entries[0]).toMatchObject({
      action: 'settings.update',
      targetId: 'governance_cooldown_days',
    })
  })

  it('PUT grava o valor com o admin do token e audita', async () => {
    const { app, adminToken, engineSettingsAdmin, auditLog } = buildApp()
    const res = await request(app)
      .put('/admin/settings/ticks_per_day')
      .set('Authorization', adminToken())
      .send({ value: 12 })
    expect(res.status).toBe(200)
    expect(engineSettingsAdmin.saved).toEqual([
      { key: 'ticks_per_day', value: 12, adminId: 'admin-1' },
    ])
    expect(auditLog.entries[0]).toMatchObject({ action: 'settings.update', result: 'success' })
  })

  it.each([{}, { value: 'doze' }, { value: 1.5 }, { value: null }])(
    'PUT com corpo %j retorna 400 sem chamar o motor',
    async (body) => {
      const { app, adminToken, engineSettingsAdmin, auditLog } = buildApp()
      const res = await request(app)
        .put('/admin/settings/ticks_per_day')
        .set('Authorization', adminToken())
        .send(body)
      expect(res.status).toBe(400)
      expect(engineSettingsAdmin.calls).toHaveLength(0)
      expect(auditLog.entries).toHaveLength(0)
    },
  )

  it('chave que não é editável retorna 404 sem chamar o motor', async () => {
    const { app, adminToken, engineSettingsAdmin } = buildApp()
    for (const method of ['put', 'delete'] as const) {
      const res = await request(app)
        [method]('/admin/settings/initial_capital')
        .set('Authorization', adminToken())
        .send({ value: 1 })
      expect(res.status).toBe(404)
    }
    expect(engineSettingsAdmin.calls).toHaveLength(0)
  })

  it('valor fora da faixa: 422 com a mensagem do motor e auditoria da falha', async () => {
    const { app, adminToken, engineSettingsAdmin, auditLog } = buildApp()
    engineSettingsAdmin.errorToThrow = new EngineSettingRejectedError('fora da faixa 1 a 24')
    const res = await request(app)
      .put('/admin/settings/ticks_per_day')
      .set('Authorization', adminToken())
      .send({ value: 99 })
    expect(res.status).toBe(422)
    expect(res.body.error).toBe('fora da faixa 1 a 24')
    expect(auditLog.entries[0]).toMatchObject({ result: 'failed' })
  })

  it('motor devolve 404 da chave: repassa 404', async () => {
    const { app, adminToken, engineSettingsAdmin } = buildApp()
    engineSettingsAdmin.errorToThrow = new EngineSettingNotFoundError('desconhecido')
    const res = await request(app)
      .delete('/admin/settings/max_catch_up')
      .set('Authorization', adminToken())
    expect(res.status).toBe(404)
  })

  it('DELETE restaura o padrão e audita settings.reset', async () => {
    const { app, adminToken, engineSettingsAdmin, auditLog } = buildApp()
    const res = await request(app)
      .delete('/admin/settings/max_catch_up')
      .set('Authorization', adminToken())
    expect(res.status).toBe(200)
    expect(engineSettingsAdmin.resets).toEqual(['max_catch_up'])
    expect(auditLog.entries[0]).toMatchObject({ action: 'settings.reset', result: 'success' })
  })
})
