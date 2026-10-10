import { createFakeAccountMailer } from '../../../auth/test/fakes/fakeAccountMailer'
import express from 'express'
import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createAuthMiddleware } from '../../../../shared/http/authMiddleware'
import { AnonymizeAccountUseCase } from '../../../auth/application/useCases/anonymizeAccount'
import { UserSessionGuard } from '../../../auth/application/services/userSessionGuard'
import { createFakeAchievementsExporter } from '../../../auth/test/fakes/fakeAchievementsExporter'
import { createFakeAuthMailer } from '../../../auth/test/fakes/fakeAuthMailer'
import { createFakeAvatarStorage } from '../../../auth/test/fakes/fakeAvatarStorage'
import { createFakeFriendshipsExporter } from '../../../auth/test/fakes/fakeFriendshipsExporter'
import { createFakeProgressionExporter } from '../../../auth/test/fakes/fakeProgressionExporter'
import { createFakeTokenIssuer } from '../../../auth/test/fakes/fakeTokenIssuer'
import { createFakeUserRepository } from '../../../auth/test/fakes/fakeUserRepository'
import { DeleteUserAccountUseCase } from '../../application/useCases/deleteUserAccount'
import { ForceLogoutUserUseCase } from '../../application/useCases/forceLogoutUser'
import { GetAdminUserDetailUseCase } from '../../application/useCases/getAdminUserDetail'
import { ListAdminUsersUseCase } from '../../application/useCases/listAdminUsers'
import { ReactivateUserUseCase } from '../../application/useCases/reactivateUser'
import { RecordAdminActionUseCase } from '../../application/useCases/recordAdminAction'
import { SuspendUserUseCase } from '../../application/useCases/suspendUser'
import { createFakeAdminUserDirectory } from '../../test/fakes/fakeAdminUserDirectory'
import { createFakeAuditLogRepository } from '../../test/fakes/fakeAuditLogRepository'
import { createFakeOrderAdmin } from '../../test/fakes/fakeOrderAdmin'
import {
  createFakeUserPortfolioReader,
  samplePortfolio,
} from '../../test/fakes/fakeUserPortfolioReader'
import { createAdminUsersRouter } from './adminUsersRouter'

async function buildApp() {
  const userRepository = createFakeUserRepository()
  const tokenIssuer = createFakeTokenIssuer()
  const auditLog = createFakeAuditLogRepository()
  const record = new RecordAdminActionUseCase(auditLog)
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
  const directory = createFakeAdminUserDirectory([
    {
      id: user.id,
      name: user.name,
      email: user.email,
      username: user.username,
      role: 'user',
      status: 'active',
      onboardingCompleted: false,
      providers: ['password'],
      createdAt: new Date('2026-10-01T00:00:00Z'),
    },
  ])
  const authMiddleware = createAuthMiddleware(tokenIssuer, new UserSessionGuard(userRepository))
  const app = express()
  app.use(express.json())
  app.use(
    createAdminUsersRouter({
      listAdminUsers: new ListAdminUsersUseCase(directory),
      getAdminUserDetail: new GetAdminUserDetailUseCase(
        userRepository,
        createFakeProgressionExporter(),
        createFakeAchievementsExporter(),
        createFakeFriendshipsExporter(),
        createFakeUserPortfolioReader(),
        createFakeOrderAdmin(),
        auditLog,
      ),
      suspendUser: new SuspendUserUseCase(userRepository, record, createFakeAccountMailer()),
      reactivateUser: new ReactivateUserUseCase(userRepository, record, createFakeAccountMailer()),
      forceLogoutUser: new ForceLogoutUserUseCase(userRepository, record, createFakeAuthMailer()),
      deleteUserAccount: new DeleteUserAccountUseCase(
        userRepository,
        new AnonymizeAccountUseCase(
          userRepository,
          createFakeAvatarStorage(),
          createFakeAccountMailer(),
        ),
        record,
      ),
      authMiddleware,
    }),
  )
  const adminToken = tokenIssuer.issue({ sub: admin.id, role: 'admin' })
  const staleAdminToken = tokenIssuer.issue({ sub: admin.id, role: 'admin', authTime: 1000 })
  const userToken = tokenIssuer.issue({ sub: user.id, role: 'user' })
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` })
  return {
    app,
    admin,
    user,
    userRepository,
    auditLog,
    adminToken,
    staleAdminToken,
    userToken,
    auth,
  }
}

describe('GET /admin/users', () => {
  it('exige papel admin', async () => {
    const { app, userToken, auth } = await buildApp()
    expect((await request(app).get('/admin/users')).status).toBe(401)
    expect((await request(app).get('/admin/users').set(auth(userToken))).status).toBe(403)
  })

  it('lista e busca em formato snake_case, sem hash de senha', async () => {
    const { app, adminToken, auth } = await buildApp()

    const res = await request(app).get('/admin/users?q=fulan').set(auth(adminToken))

    expect(res.status).toBe(200)
    expect(res.body.total).toBe(1)
    expect(res.body.users[0]).toMatchObject({
      username: 'fulano',
      status: 'active',
      providers: ['password'],
    })
    expect(JSON.stringify(res.body)).not.toMatch(/password_hash|passwordHash/)
  })

  it('devolve 400 para filtro inválido', async () => {
    const { app, adminToken, auth } = await buildApp()
    const res = await request(app).get('/admin/users?status=banido&limit=0').set(auth(adminToken))
    expect(res.status).toBe(400)
  })
})

describe('GET /admin/users/:id', () => {
  it('devolve o detalhe com patrimônio absoluto (exceção do admin)', async () => {
    const { app, adminToken, user, auth } = await buildApp()

    const res = await request(app).get(`/admin/users/${user.id}`).set(auth(adminToken))

    expect(res.status).toBe(200)
    expect(res.body.account).toMatchObject({ id: user.id, status: 'active' })
    expect(res.body.portfolio.net_worth).toBe(samplePortfolio.net_worth)
    expect(res.body.progression).toHaveProperty('current_streak')
    expect(res.body.timeline).toEqual([])
  })

  it('devolve 404 para id inexistente e 400 para id que não é uuid', async () => {
    const { app, adminToken, auth } = await buildApp()
    expect(
      (
        await request(app)
          .get('/admin/users/6f9619ff-8b86-d011-b42d-00c04fc964ff')
          .set(auth(adminToken))
      ).status,
    ).toBe(404)
    expect((await request(app).get('/admin/users/abc').set(auth(adminToken))).status).toBe(400)
  })
})

describe('POST /admin/users/:id/suspend', () => {
  it('suspende, e o token antigo do usuário passa a receber 403 account_suspended', async () => {
    const { app, adminToken, user, userToken, auth } = await buildApp()

    const res = await request(app)
      .post(`/admin/users/${user.id}/suspend`)
      .set(auth(adminToken))
      .send({ reason: 'spam no feed' })
    expect(res.status).toBe(204)

    const asUser = await request(app).get('/admin/users').set(auth(userToken))
    expect(asUser.status).toBe(403)
    // O 403 de papel só aparece se a guarda deixar passar; suspenso é barrado antes.
    expect(asUser.body).toEqual({ error: 'account_suspended' })
  })

  it('exige motivo, senha recente e papel admin', async () => {
    const { app, adminToken, staleAdminToken, userToken, user, auth } = await buildApp()
    const url = `/admin/users/${user.id}/suspend`
    expect((await request(app).post(url).set(auth(adminToken)).send({})).status).toBe(400)
    const stale = await request(app).post(url).set(auth(staleAdminToken)).send({ reason: 'spam' })
    expect(stale.status).toBe(401)
    expect(stale.body).toEqual({ error: 'reauth_required' })
    expect(
      (await request(app).post(url).set(auth(userToken)).send({ reason: 'spam' })).status,
    ).toBe(403)
  })

  it('recusa suspender administrador (422) e conta já suspensa (409)', async () => {
    const { app, adminToken, admin, user, auth } = await buildApp()
    const adminRes = await request(app)
      .post(`/admin/users/${admin.id}/suspend`)
      .set(auth(adminToken))
      .send({ reason: 'teste' })
    expect(adminRes.status).toBe(422)
    expect(adminRes.body.code).toBe('admin_account_protected')

    await request(app)
      .post(`/admin/users/${user.id}/suspend`)
      .set(auth(adminToken))
      .send({ reason: 'primeira' })
    const again = await request(app)
      .post(`/admin/users/${user.id}/suspend`)
      .set(auth(adminToken))
      .send({ reason: 'segunda' })
    expect(again.status).toBe(409)
  })
})

describe('POST /admin/users/:id/reactivate', () => {
  it('reativa, e o histórico fica na linha do tempo do detalhe', async () => {
    const { app, adminToken, user, auth } = await buildApp()
    await request(app)
      .post(`/admin/users/${user.id}/suspend`)
      .set(auth(adminToken))
      .send({ reason: 'spam' })

    expect(
      (await request(app).post(`/admin/users/${user.id}/reactivate`).set(auth(adminToken))).status,
    ).toBe(204)

    const detail = await request(app).get(`/admin/users/${user.id}`).set(auth(adminToken))
    expect(detail.body.account.status).toBe('active')
    expect(detail.body.timeline.map((e: { action: string }) => e.action)).toEqual([
      'user.reactivate',
      'user.suspend',
    ])
  })

  it('devolve 409 se a conta não está suspensa', async () => {
    const { app, adminToken, user, auth } = await buildApp()
    expect(
      (await request(app).post(`/admin/users/${user.id}/reactivate`).set(auth(adminToken))).status,
    ).toBe(409)
  })
})

describe('POST /admin/users/:id/force-logout', () => {
  it('invalida o token antigo do usuário (401), exige senha recente', async () => {
    const { app, adminToken, staleAdminToken, user, userToken, auth } = await buildApp()
    const url = `/admin/users/${user.id}/force-logout`
    expect((await request(app).post(url).set(auth(staleAdminToken))).status).toBe(401)

    expect((await request(app).post(url).set(auth(adminToken))).status).toBe(204)

    const asUser = await request(app).get('/admin/users').set(auth(userToken))
    expect(asUser.status).toBe(401)
  })
})

describe('DELETE /admin/users/:id', () => {
  it('exige o username digitado de volta e anonimiza a conta', async () => {
    const { app, adminToken, user, userRepository, auth } = await buildApp()
    const url = `/admin/users/${user.id}`

    expect((await request(app).delete(url).set(auth(adminToken)).send({})).status).toBe(400)
    const wrong = await request(app)
      .delete(url)
      .set(auth(adminToken))
      .send({ confirm_username: 'outro' })
    expect(wrong.status).toBe(422)
    expect(wrong.body.code).toBe('confirmation_mismatch')

    expect(
      (await request(app).delete(url).set(auth(adminToken)).send({ confirm_username: 'fulano' }))
        .status,
    ).toBe(204)
    expect((await userRepository.findById(user.id))?.name).toBe('Usuário removido')
  })

  it('exige senha recente', async () => {
    const { app, staleAdminToken, user, auth } = await buildApp()
    const res = await request(app)
      .delete(`/admin/users/${user.id}`)
      .set(auth(staleAdminToken))
      .send({ confirm_username: 'fulano' })
    expect(res.status).toBe(401)
  })
})
