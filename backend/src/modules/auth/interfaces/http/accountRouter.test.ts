import { createFakeAccountMailer } from '../../test/fakes/fakeAccountMailer'
import { createFakeEmailDataEraser } from '../../test/fakes/fakeEmailDataEraser'
import { createFakeEmailPreferencesExporter } from '../../test/fakes/fakeEmailPreferencesExporter'
import express from 'express'
import { beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createAuthMiddleware } from '../../../../shared/http/authMiddleware'
import { AnonymizeAccountUseCase } from '../../application/useCases/anonymizeAccount'
import { ChangePasswordUseCase } from '../../application/useCases/changePassword'
import { ExportUserDataUseCase } from '../../application/useCases/exportUserData'
import { ListIdentitiesUseCase } from '../../application/useCases/listIdentities'
import { UpdateProfileUseCase } from '../../application/useCases/updateProfile'
import { MAX_AVATAR_SIZE_BYTES, UploadAvatarUseCase } from '../../application/useCases/uploadAvatar'
import { createFakeAchievementsExporter } from '../../test/fakes/fakeAchievementsExporter'
import { createFakeAuthMailer } from '../../test/fakes/fakeAuthMailer'
import { createFakeAvatarStorage } from '../../test/fakes/fakeAvatarStorage'
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
  const changePassword = new ChangePasswordUseCase(
    userRepository,
    passwordHasher,
    createFakeAuthMailer(),
  )
  const listIdentities = new ListIdentitiesUseCase(userRepository)
  const exportUserData = new ExportUserDataUseCase(
    userRepository,
    createFakeProgressionExporter(),
    createFakeLessonProgressExporter(),
    createFakeAchievementsExporter(),
    createFakeFriendshipsExporter(),
    createFakeMissionProgressExporter(),
    createFakeEmailPreferencesExporter(),
    createFakeAccountMailer(),
  )
  const { storage: avatarStorage, saved: savedAvatars } = createFakeAvatarStorage()
  const anonymizeAccount = new AnonymizeAccountUseCase(
    userRepository,
    avatarStorage,
    createFakeAccountMailer(),
    createFakeEmailDataEraser(),
  )
  const uploadAvatar = new UploadAvatarUseCase(userRepository, avatarStorage)
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
      uploadAvatar,
      authMiddleware,
    }),
  )
  return { app, tokenIssuer, alice, bob, savedAvatars }
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

  it('PATCH /me não aceita trocar o e-mail (D6): só o e-mail no corpo vira 400, junto com outro campo é ignorado', async () => {
    const { app, tokenIssuer, alice, bob } = await buildApp()
    const token = tokenIssuer.issue({ sub: alice.id, role: 'user' })

    const only = await request(app)
      .patch('/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: bob.email })
    expect(only.status).toBe(400)

    const mixed = await request(app)
      .patch('/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Alice Nova', email: 'novo@example.com' })
    expect(mixed.status).toBe(200)
    expect(mixed.body.user.name).toBe('Alice Nova')
    expect(mixed.body.user.email).toBe(alice.email)
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

  it('POST /me/password rejeita senha atual errada sem trocar nada (403, não 401)', async () => {
    const { app, tokenIssuer, alice } = await buildApp()
    const token = tokenIssuer.issue({ sub: alice.id, role: 'user' })

    const res = await request(app)
      .post('/me/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'errada', newPassword: 'senha-nova-123' })

    // 403, não 401: token válido, só a senha atual está errada — um 401
    // aqui derrubaria a sessão do usuário no frontend (handler global de
    // "sessão inválida" do client HTTP), achado da tarefa 6.10.
    expect(res.status).toBe(403)
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

  it('POST /me/avatar salva o arquivo e devolve avatarUrl (6.10.8)', async () => {
    const { app, tokenIssuer, alice, savedAvatars } = await buildApp()
    const token = tokenIssuer.issue({ sub: alice.id, role: 'user' })

    const res = await request(app)
      .post('/me/avatar')
      .set('Authorization', `Bearer ${token}`)
      .attach('avatar', Buffer.from('fake-png-bytes'), {
        filename: 'foto.png',
        contentType: 'image/png',
      })

    expect(res.status).toBe(200)
    expect(res.body.user.avatarUrl).toMatch(/^\/avatars\/.+\.png$/)
    expect(savedAvatars.size).toBe(1)
  })

  it('POST /me/avatar rejeita arquivo acima do limite com erro JSON, não a página HTML padrão do Express (400)', async () => {
    const { app, tokenIssuer, alice } = await buildApp()
    const token = tokenIssuer.issue({ sub: alice.id, role: 'user' })

    const res = await request(app)
      .post('/me/avatar')
      .set('Authorization', `Bearer ${token}`)
      .attach('avatar', Buffer.alloc(MAX_AVATAR_SIZE_BYTES + 1), {
        filename: 'foto.png',
        contentType: 'image/png',
      })

    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: 'arquivo maior que o limite de 5MB' })
  })

  it('POST /me/avatar rejeita tipo de arquivo não suportado (400)', async () => {
    const { app, tokenIssuer, alice } = await buildApp()
    const token = tokenIssuer.issue({ sub: alice.id, role: 'user' })

    const res = await request(app)
      .post('/me/avatar')
      .set('Authorization', `Bearer ${token}`)
      .attach('avatar', Buffer.from('fake-gif-bytes'), {
        filename: 'foto.gif',
        contentType: 'image/gif',
      })

    expect(res.status).toBe(400)
  })

  it('POST /me/avatar sem arquivo retorna 400', async () => {
    const { app, tokenIssuer, alice } = await buildApp()
    const token = tokenIssuer.issue({ sub: alice.id, role: 'user' })

    const res = await request(app).post('/me/avatar').set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(400)
  })

  it('POST /me/avatar sem token retorna 401', async () => {
    const { app } = await buildApp()

    const res = await request(app)
      .post('/me/avatar')
      .attach('avatar', Buffer.from('x'), { filename: 'foto.png', contentType: 'image/png' })

    expect(res.status).toBe(401)
  })
})
