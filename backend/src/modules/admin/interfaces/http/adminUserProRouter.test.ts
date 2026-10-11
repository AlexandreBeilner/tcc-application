import express from 'express'
import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createAuthMiddleware } from '../../../../shared/http/authMiddleware'
import { UserSessionGuard } from '../../../auth/application/services/userSessionGuard'
import { createFakeTokenIssuer } from '../../../auth/test/fakes/fakeTokenIssuer'
import { createFakeUserRepository } from '../../../auth/test/fakes/fakeUserRepository'
import { RecordAdminActionUseCase } from '../../application/useCases/recordAdminAction'
import {
  GetUserProStatusUseCase,
  GrantUserProUseCase,
} from '../../application/useCases/userProGrants'
import { ProGrantProviderError, ProGrantUnavailableError } from '../../domain/errors'
import { createFakeAuditLogRepository } from '../../test/fakes/fakeAuditLogRepository'
import { createFakeUserProGrants } from '../../test/fakes/fakeUserProGrants'
import { createAdminUserProRouter } from './adminUserProRouter'

const UNKNOWN_USER_ID = '6f9619ff-8b86-d011-b42d-00c04fc964ff'

async function buildApp() {
  const userRepository = createFakeUserRepository()
  const tokenIssuer = createFakeTokenIssuer()
  const auditLog = createFakeAuditLogRepository()
  const proGrants = createFakeUserProGrants()
  const admin = await userRepository.createUser({
    name: 'Admin',
    email: 'admin@example.com',
    username: 'admin',
    passwordHash: 'x',
    role: 'admin',
  })
  const user = await userRepository.createUser({
    name: 'Fulano',
    email: 'fulano@example.com',
    username: 'fulano',
    passwordHash: 'x',
  })
  const app = express()
  app.use(express.json())
  app.use(
    createAdminUserProRouter({
      getUserProStatus: new GetUserProStatusUseCase(userRepository, proGrants),
      grantUserPro: new GrantUserProUseCase(
        userRepository,
        proGrants,
        new RecordAdminActionUseCase(auditLog),
      ),
      authMiddleware: createAuthMiddleware(tokenIssuer, new UserSessionGuard(userRepository)),
    }),
  )
  return {
    app,
    user,
    auditLog,
    proGrants,
    auth: (token: string) => ({ Authorization: `Bearer ${token}` }),
    adminToken: tokenIssuer.issue({ sub: admin.id, role: 'admin' }),
    staleAdminToken: tokenIssuer.issue({ sub: admin.id, role: 'admin', authTime: 1000 }),
    userToken: tokenIssuer.issue({ sub: user.id, role: 'user' }),
  }
}

describe('GET /admin/users/:id/pro', () => {
  it('devolve o plano da pessoa', async () => {
    const { app, user, adminToken, auth, proGrants } = await buildApp()
    proGrants.status = {
      isPro: true,
      state: 'active',
      plan: 'annual',
      store: 'stripe',
      expiresAt: '2027-01-01T00:00:00.000Z',
    }
    const res = await request(app).get(`/admin/users/${user.id}/pro`).set(auth(adminToken))
    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      is_pro: true,
      state: 'active',
      plan: 'annual',
      store: 'stripe',
      expires_at: '2027-01-01T00:00:00.000Z',
    })
  })

  it('exige admin e devolve 404 para usuário inexistente', async () => {
    const { app, user, adminToken, userToken, auth } = await buildApp()
    expect((await request(app).get(`/admin/users/${user.id}/pro`)).status).toBe(401)
    expect(
      (await request(app).get(`/admin/users/${user.id}/pro`).set(auth(userToken))).status,
    ).toBe(403)
    expect(
      (await request(app).get(`/admin/users/${UNKNOWN_USER_ID}/pro`).set(auth(adminToken))).status,
    ).toBe(404)
  })
})

describe('POST /admin/users/:id/pro-grants', () => {
  it('concede, devolve o fim do acesso e audita', async () => {
    const { app, user, adminToken, auth, proGrants, auditLog } = await buildApp()
    const res = await request(app)
      .post(`/admin/users/${user.id}/pro-grants`)
      .set(auth(adminToken))
      .send({ days: 30, reason: 'parceria com a faculdade' })

    expect(res.status).toBe(200)
    expect(res.body.user_id).toBe(user.id)
    expect(res.body.previous_access_end).toBeNull()
    expect(proGrants.granted).toHaveLength(1)
    expect(new Date(res.body.ends_at).getTime()).toBe(proGrants.granted[0].endsAt.getTime())
    expect(auditLog.entries[0]).toMatchObject({
      action: 'billing.grant_promotional',
      targetId: user.id,
      payload: { days: 30, reason: 'parceria com a faculdade' },
    })
  })

  it.each([
    ['sem motivo', { days: 10 }],
    ['motivo curto', { days: 10, reason: 'ok' }],
    ['zero dias', { days: 0, reason: 'cortesia' }],
    ['91 dias', { days: 91, reason: 'cortesia' }],
    ['fracionado', { days: 2.5, reason: 'cortesia' }],
    ['texto', { days: 'dez', reason: 'cortesia' }],
  ])('recusa corpo inválido (%s) com 400, sem chamar o provedor', async (_name, body) => {
    const { app, user, adminToken, auth, proGrants } = await buildApp()
    const res = await request(app)
      .post(`/admin/users/${user.id}/pro-grants`)
      .set(auth(adminToken))
      .send(body)
    expect(res.status).toBe(400)
    expect(proGrants.granted).toEqual([])
  })

  it('exige senha recente (401 reauth_required) e papel admin', async () => {
    const { app, user, staleAdminToken, userToken, auth, proGrants } = await buildApp()
    const body = { days: 5, reason: 'cortesia' }
    const stale = await request(app)
      .post(`/admin/users/${user.id}/pro-grants`)
      .set(auth(staleAdminToken))
      .send(body)
    expect(stale.status).toBe(401)
    expect(stale.body.error).toBe('reauth_required')
    expect(
      (
        await request(app)
          .post(`/admin/users/${user.id}/pro-grants`)
          .set(auth(userToken))
          .send(body)
      ).status,
    ).toBe(403)
    expect(proGrants.granted).toEqual([])
  })

  it('mapeia usuário inexistente (404), PRO vitalício (409), cobrança desligada (503) e falha do provedor (502)', async () => {
    const { app, user, adminToken, auth, proGrants } = await buildApp()
    const body = { days: 5, reason: 'cortesia' }
    const post = (id: string) =>
      request(app).post(`/admin/users/${id}/pro-grants`).set(auth(adminToken)).send(body)

    expect((await post(UNKNOWN_USER_ID)).status).toBe(404)

    proGrants.accessEnd = new Date(8.64e15)
    expect((await post(user.id)).status).toBe(409)
    proGrants.accessEnd = null

    proGrants.errorToThrow = new ProGrantUnavailableError('cobrança desligada neste ambiente')
    const disabled = await post(user.id)
    expect(disabled.status).toBe(503)
    expect(disabled.body.code).toBe('billing_disabled')

    proGrants.errorToThrow = new ProGrantProviderError('timeout')
    const provider = await post(user.id)
    expect(provider.status).toBe(502)
    expect(provider.body.code).toBe('billing_provider_error')
  })
})
