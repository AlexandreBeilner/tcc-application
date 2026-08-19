import express from 'express'
import { beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createAuthMiddleware } from '../../../../shared/http/authMiddleware'
import { GetCurrentUserUseCase } from '../../application/useCases/getCurrentUser'
import { LoginUserUseCase } from '../../application/useCases/loginUser'
import { LoginWithGoogleUseCase } from '../../application/useCases/loginWithGoogle'
import { RegisterUserUseCase } from '../../application/useCases/registerUser'
import { createFakeAccountProvisioner } from '../../test/fakes/fakeAccountProvisioner'
import { createFakeGoogleIdentityProvider } from '../../test/fakes/fakeGoogleIdentityProvider'
import { createFakePasswordHasher } from '../../test/fakes/fakePasswordHasher'
import { createFakeTokenIssuer } from '../../test/fakes/fakeTokenIssuer'
import { createFakeUserRepository } from '../../test/fakes/fakeUserRepository'
import { createAuthRouter } from './authRouter'

function buildApp() {
  const userRepository = createFakeUserRepository()
  const passwordHasher = createFakePasswordHasher()
  const tokenIssuer = createFakeTokenIssuer()
  const accountProvisioner = createFakeAccountProvisioner()
  const googleIdentityProvider = createFakeGoogleIdentityProvider({
    providerAccountId: 'google-123',
    email: 'google@example.com',
    name: 'Usuário Google',
  })
  const authMiddleware = createAuthMiddleware(tokenIssuer)

  const app = express()
  app.use(express.json())
  app.use(
    createAuthRouter({
      registerUser: new RegisterUserUseCase(
        userRepository,
        passwordHasher,
        tokenIssuer,
        accountProvisioner,
      ),
      loginUser: new LoginUserUseCase(userRepository, passwordHasher, tokenIssuer),
      getCurrentUser: new GetCurrentUserUseCase(userRepository),
      loginWithGoogle: new LoginWithGoogleUseCase(
        userRepository,
        googleIdentityProvider,
        tokenIssuer,
        accountProvisioner,
      ),
      googleIdentityProvider,
      authMiddleware,
    }),
  )
  return app
}

describe('auth routes', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'segredo-de-teste'
  })

  it('POST /auth/register cria usuário comum e ignora role enviada no corpo', async () => {
    const res = await request(buildApp()).post('/auth/register').send({
      name: 'Alexandre',
      email: 'alexandre@example.com',
      username: 'alexandreb',
      password: 'senha-forte-123',
      role: 'admin',
    })

    expect(res.status).toBe(201)
    expect(res.body.user.role).toBe('user')
    expect(typeof res.body.token).toBe('string')
  })

  it('POST /auth/register recusa e-mail duplicado', async () => {
    const app = buildApp()
    const payload = {
      name: 'A',
      email: 'dup@example.com',
      username: 'usera1',
      password: 'senha-forte-123',
    }

    await request(app).post('/auth/register').send(payload)
    const res = await request(app)
      .post('/auth/register')
      .send({ ...payload, username: 'usera2' })

    expect(res.status).toBe(409)
  })

  it('POST /auth/register recusa dados inválidos', async () => {
    const res = await request(buildApp())
      .post('/auth/register')
      .send({ name: '', email: 'x', username: '', password: '123' })

    expect(res.status).toBe(400)
  })

  it('POST /auth/login retorna token com credenciais corretas', async () => {
    const app = buildApp()
    await request(app).post('/auth/register').send({
      name: 'Alexandre',
      email: 'login@example.com',
      username: 'loginuser',
      password: 'senha-forte-123',
    })

    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'login@example.com', password: 'senha-forte-123' })

    expect(res.status).toBe(200)
    expect(typeof res.body.token).toBe('string')
  })

  it('POST /auth/login recusa senha incorreta', async () => {
    const app = buildApp()
    await request(app).post('/auth/register').send({
      name: 'Alexandre',
      email: 'wrongpass@example.com',
      username: 'wrongpass',
      password: 'senha-forte-123',
    })

    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'wrongpass@example.com', password: 'outra-senha' })

    expect(res.status).toBe(401)
  })

  it('GET /auth/me exige token', async () => {
    const res = await request(buildApp()).get('/auth/me')
    expect(res.status).toBe(401)
  })

  it('GET /auth/me retorna o usuário autenticado', async () => {
    const app = buildApp()
    const registerRes = await request(app).post('/auth/register').send({
      name: 'Alexandre',
      email: 'me@example.com',
      username: 'meuser',
      password: 'senha-forte-123',
    })

    const res = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${registerRes.body.token}`)

    expect(res.status).toBe(200)
    expect(res.body.user.email).toBe('me@example.com')
  })

  it('GET /auth/google redireciona pra URL de autorização do provedor', async () => {
    const res = await request(buildApp()).get('/auth/google')
    expect(res.status).toBe(302)
    expect(res.headers.location).toContain('fake-google-auth')
  })

  it('GET /auth/google/callback autentica e redireciona pro frontend com token', async () => {
    const res = await request(buildApp()).get('/auth/google/callback?code=auth-code')
    expect(res.status).toBe(302)
    expect(res.headers.location).toContain('/auth/callback#token=')
  })
})
