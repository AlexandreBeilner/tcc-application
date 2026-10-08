import express from 'express'
import { describe, expect, it } from 'vitest'
import request from 'supertest'
import { createAuthMiddleware } from '../../../../shared/http/authMiddleware'
import { createFakeTokenIssuer } from '../../../auth/test/fakes/fakeTokenIssuer'
import {
  GetIntegrityRunUseCase,
  StartIntegrityCheckUseCase,
} from '../../application/useCases/integrity'
import { RecordAdminActionUseCase } from '../../application/useCases/recordAdminAction'
import { createFakeAuditLogRepository } from '../../test/fakes/fakeAuditLogRepository'
import { createFakeIntegrityAdmin, sampleRun } from '../../test/fakes/fakeIntegrityAdmin'
import { createAdminIntegrityRouter } from './adminIntegrityRouter'

function buildApp() {
  const tokenIssuer = createFakeTokenIssuer()
  const integrityAdmin = createFakeIntegrityAdmin()
  const auditLog = createFakeAuditLogRepository()
  const app = express()
  app.use(express.json())
  app.use(
    createAdminIntegrityRouter({
      startIntegrityCheck: new StartIntegrityCheckUseCase(
        integrityAdmin,
        new RecordAdminActionUseCase(auditLog),
      ),
      getIntegrityRun: new GetIntegrityRunUseCase(integrityAdmin),
      authMiddleware: createAuthMiddleware(tokenIssuer),
    }),
  )
  const adminToken = () => `Bearer ${tokenIssuer.issue({ sub: 'admin-1', role: 'admin' })}`
  const userToken = () => `Bearer ${tokenIssuer.issue({ sub: 'user-1', role: 'user' })}`
  return { app, integrityAdmin, auditLog, adminToken, userToken }
}

const routes: Array<[string, 'get' | 'post', string]> = [
  ['POST /admin/integrity/check', 'post', '/admin/integrity/check'],
  ['GET /admin/integrity/check', 'get', '/admin/integrity/check'],
]

describe('rotas admin de integridade financeira (N.21)', () => {
  it.each(routes)('%s retorna 401 sem token', async (_n, method, path) => {
    const { app } = buildApp()
    expect((await request(app)[method](path)).status).toBe(401)
  })

  it.each(routes)(
    '%s retorna 403 para usuário comum, sem chamar o motor',
    async (_n, method, path) => {
      const { app, userToken, integrityAdmin, auditLog } = buildApp()
      expect((await request(app)[method](path).set('Authorization', userToken())).status).toBe(403)
      expect(integrityAdmin.calls).toHaveLength(0)
      expect(auditLog.entries).toHaveLength(0)
    },
  )

  it('GET sem verificação devolve run nulo', async () => {
    const { app, adminToken } = buildApp()
    const res = await request(app).get('/admin/integrity/check').set('Authorization', adminToken())
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ run: null })
  })

  it('POST abre a verificação com 202 e audita; GET devolve a última', async () => {
    const { app, adminToken, auditLog } = buildApp()
    const started = await request(app)
      .post('/admin/integrity/check')
      .set('Authorization', adminToken())
    expect(started.status).toBe(202)
    expect(started.body).toEqual(sampleRun)
    expect(auditLog.entries[0]).toMatchObject({ action: 'integrity.check', targetId: 'run-1' })

    const latest = await request(app)
      .get('/admin/integrity/check')
      .set('Authorization', adminToken())
    expect(latest.body).toEqual({ run: sampleRun })
  })

  it('POST com uma verificação em andamento devolve 409', async () => {
    const { app, adminToken } = buildApp()
    await request(app).post('/admin/integrity/check').set('Authorization', adminToken())
    const second = await request(app)
      .post('/admin/integrity/check')
      .set('Authorization', adminToken())
    expect(second.status).toBe(409)
  })
})
