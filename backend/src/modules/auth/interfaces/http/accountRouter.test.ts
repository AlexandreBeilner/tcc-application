import express from 'express'
import { beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createAuthMiddleware } from '../../../../shared/http/authMiddleware'
import { AnonymizeAccountUseCase } from '../../application/useCases/anonymizeAccount'
import { ChangePasswordUseCase } from '../../application/useCases/changePassword'
import { ExportUserDataUseCase } from '../../application/useCases/exportUserData'
import { ListIdentitiesUseCase } from '../../application/useCases/listIdentities'
import { UpdateProfileUseCase } from '../../application/useCases/updateProfile'
import { createFakeAchievementsExporter } from '../../test/fakes/fakeAchievementsExporter'
import { createFakeFriendshipsExporter } from '../../test/fakes/fakeFriendshipsExporter'
import { createFakeLessonProgressExporter } from '../../test/fakes/fakeLessonProgressExporter'
import { createFakeMissionProgressExporter } from '../../test/fakes/fakeMissionProgressExporter'
import { createFakePasswordHasher } from '../../test/fakes/fakePasswordHasher'
import { createFakeProgressionExporter } from '../../test/fakes/fakeProgressionExporter'
import { createFakeTokenIssuer } from '../../test/fakes/fakeTokenIssuer'
import { createFakeUserRepository } from '../../test/fakes/fakeUserRepository'
import { createAccountRouter } from './accountRouter'

async function buildApp() {
  const userRepository = createFakeUserRepository()
  const passwordHasher = createFakePasswordHasher()
  const alice = await userRepository.createUser({
    name: 'Alice',
    email: 'alice@example.com',
    username: 'alice',
    passwordHash: 'hashed:senha-antiga',
  })
  const bob = await userRepository.createUser({
    name: 'Bob',
    email: 'bob@example.com',
    username: 'bob',
    passwordHash: 'hashed:senha',
  })

  const updateProfile = new UpdateProfileUseCase(userRepository)
  const changePassword = new ChangePasswordUseCase(userRepository, passwordHasher)
  const listIdentities = new ListIdentitiesUseCase(userRepository)
  const exportUserData = new ExportUserDataUseCase(
    userRepository,
    createFakeProgressionExporter(),
    createFakeLessonProgressExporter(),
    createFakeAchievementsExporter(),
    createFakeFriendshipsExporter(),
    createFakeMissionProgressExporter(),
  )
  const anonymizeAccount = new AnonymizeAccountUseCase(userRepository)
  const tokenIssuer = createFakeTokenIssuer()
  const authMiddleware = createAuthMiddleware(tokenIssuer)

  const app = express()
  app.use(express.json())
  app.use(
    createAccountRouter({
      updateProfile,
      changePassword,
      listIdentities,
      exportUserData,
      anonymizeAccount,
      authMiddleware,
    }),
  )
  return { app, tokenIssuer, alice, bob }
}

describe('account routes', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'segredo-de-teste'
  })

  it('PATCH /me retorna 401 sem token', async () => {
    const { app } = await buildApp()

    const res = await request(app).patch('/me').send({ name: 'x' })

    expect(res.status).toBe(401)
  })

  it('PATCH /me atualiza o perfil', async () => {
    const { app, tokenIssuer, alice } = await buildApp()
    const token = tokenIssuer.issue({ sub: alice.id, role: 'user' })

    const res = await request(app)
      .patch('/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Alice Nova' })

    expect(res.status).toBe(200)
    expect(res.body.user.name).toBe('Alice Nova')
  })

  it('PATCH /me marca onboardingCompleted', async () => {
    const { app, tokenIssuer, alice } = await buildApp()
    const token = tokenIssuer.issue({ sub: alice.id, role: 'user' })

    const res = await request(app)
      .patch('/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ onboardingCompleted: true })

    expect(res.status).toBe(200)
    expect(res.body.user.onboardingCompleted).toBe(true)
  })

  it('PATCH /me retorna 409 pra e-mail já em uso por outro usuário', async () => {
    const { app, tokenIssuer, alice, bob } = await buildApp()
    const token = tokenIssuer.issue({ sub: alice.id, role: 'user' })

    const res = await request(app)
      .patch('/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: bob.email })

    expect(res.status).toBe(409)
  })

  it('PATCH /me retorna 400 sem nenhum campo', async () => {
    const { app, tokenIssuer, alice } = await buildApp()
    const token = tokenIssuer.issue({ sub: alice.id, role: 'user' })

    const res = await request(app).patch('/me').set('Authorization', `Bearer ${token}`).send({})

    expect(res.status).toBe(400)
  })

  it('POST /me/password troca a senha com sucesso', async () => {
    const { app, tokenIssuer, alice } = await buildApp()
    const token = tokenIssuer.issue({ sub: alice.id, role: 'user' })

    const res = await request(app)
      .post('/me/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'senha-antiga', newPassword: 'senha-nova-123' })

    expect(res.status).toBe(200)
  })

  it('POST /me/password rejeita senha atual errada sem trocar nada (401)', async () => {
    const { app, tokenIssuer, alice } = await buildApp()
    const token = tokenIssuer.issue({ sub: alice.id, role: 'user' })

    const res = await request(app)
      .post('/me/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'errada', newPassword: 'senha-nova-123' })

    expect(res.status).toBe(401)
  })

  it('GET /me/identities lista os provedores conectados', async () => {
    const { app, tokenIssuer, alice } = await buildApp()
    const token = tokenIssuer.issue({ sub: alice.id, role: 'user' })

    const res = await request(app).get('/me/identities').set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.identities).toEqual([])
  })

  it('GET /me/export devolve os dados do próprio usuário', async () => {
    const { app, tokenIssuer, alice } = await buildApp()
    const token = tokenIssuer.issue({ sub: alice.id, role: 'user' })

    const res = await request(app).get('/me/export').set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.export.user.username).toBe('alice')
  })

  it('DELETE /me anonimiza a conta e retorna 204', async () => {
    const { app, tokenIssuer, alice } = await buildApp()
    const token = tokenIssuer.issue({ sub: alice.id, role: 'user' })

    const res = await request(app).delete('/me').set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(204)
  })
})
