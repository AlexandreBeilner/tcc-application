import { createFakeAccountMailer } from '../../test/fakes/fakeAccountMailer'
import express from 'express'
import { beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createAuthMiddleware } from '../../../../shared/http/authMiddleware'
import { GetCurrentUserUseCase } from '../../application/useCases/getCurrentUser'
import { LoginUserUseCase } from '../../application/useCases/loginUser'
import { LoginWithGoogleUseCase } from '../../application/useCases/loginWithGoogle'
import { ReauthenticateUseCase } from '../../application/useCases/reauthenticate'
import { RegisterUserUseCase } from '../../application/useCases/registerUser'
import { RequestPasswordResetUseCase } from '../../application/useCases/requestPasswordReset'
import { ResetPasswordUseCase } from '../../application/useCases/resetPassword'
import { SendEmailVerificationUseCase } from '../../application/useCases/sendEmailVerification'
import { VerifyEmailUseCase } from '../../application/useCases/verifyEmail'
import { createFakeAuthEmailTokenRepository } from '../../test/fakes/fakeAuthEmailTokenRepository'
import { createFakeAuthMailer } from '../../test/fakes/fakeAuthMailer'
import { createFakeEmailTokenGenerator } from '../../test/fakes/fakeEmailTokenGenerator'
import { createFakeAccountProvisioner } from '../../test/fakes/fakeAccountProvisioner'
import { createFakeGoogleIdentityProvider } from '../../test/fakes/fakeGoogleIdentityProvider'
import { createFakePasswordHasher } from '../../test/fakes/fakePasswordHasher'
import { createFakeTokenIssuer } from '../../test/fakes/fakeTokenIssuer'
import { createFakeUserRepository } from '../../test/fakes/fakeUserRepository'
import { createAuthRouter } from './authRouter'

function buildApp(options: { googleEmailVerified?: boolean } = {}) {
  const userRepository = createFakeUserRepository()
  const passwordHasher = createFakePasswordHasher()
  const tokenIssuer = createFakeTokenIssuer()
  const accountProvisioner = createFakeAccountProvisioner()
  const googleIdentityProvider = createFakeGoogleIdentityProvider({
    providerAccountId: 'google-123',
    email: 'google@example.com',
    name: 'Usuário Google',
    emailVerified: options.googleEmailVerified ?? true,
  })
  const authMiddleware = createAuthMiddleware(tokenIssuer)
  const authEmailTokens = createFakeAuthEmailTokenRepository()
  const authMailer = createFakeAuthMailer()
  const emailTokenGenerator = createFakeEmailTokenGenerator()

  const sendEmailVerification = new SendEmailVerificationUseCase(
    userRepository,
    authEmailTokens,
    emailTokenGenerator,
    authMailer,
  )

  const app = express()
  app.use(express.json())
  app.use(
    createAuthRouter({
      registerUser: new RegisterUserUseCase(
        userRepository,
        passwordHasher,
        accountProvisioner,
        sendEmailVerification,
      ),
      loginUser: new LoginUserUseCase(userRepository, passwordHasher, tokenIssuer),
      getCurrentUser: new GetCurrentUserUseCase(userRepository),
      loginWithGoogle: new LoginWithGoogleUseCase(
        userRepository,
        googleIdentityProvider,
        tokenIssuer,
        accountProvisioner,
        createFakeAccountMailer(),
      ),
      reauthenticate: new ReauthenticateUseCase(userRepository, passwordHasher, tokenIssuer),
      requestPasswordReset: new RequestPasswordResetUseCase(
        userRepository,
        authEmailTokens,
        emailTokenGenerator,
        authMailer,
      ),
      resetPassword: new ResetPasswordUseCase(
        userRepository,
        authEmailTokens,
        emailTokenGenerator,
        passwordHasher,
        authMailer,
      ),
      sendEmailVerification,
      verifyEmail: new VerifyEmailUseCase(
        userRepository,
        authEmailTokens,
        emailTokenGenerator,
        createFakeAccountMailer(),
      ),
      googleIdentityProvider,
      authMiddleware,
    }),
  )
  return Object.assign(app, { authMailer, authEmailTokens, userRepository })
}

// Cadastro novo não entra sem verificar o e-mail (D2): os testes que precisam de sessão
// confirmam a conta direto no repositório e fazem o login de verdade.
async function registerVerified(
  app: ReturnType<typeof buildApp>,
  body: { name: string; email: string; username: string; password: string },
): Promise<string> {
  await request(app).post('/auth/register').send(body)
  const user = await app.userRepository.findByEmail(body.email)
  await app.userRepository.updateUser(user!.id, { emailVerifiedAt: new Date() })
  const login = await request(app)
    .post('/auth/login')
    .send({ email: body.email, password: body.password })
  return login.body.token as string
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
    expect(res.body.user.onboardingCompleted).toBe(false)
    // Sem sessão (D2): a conta só entra depois de verificar o e-mail.
    expect(res.body.token).toBeUndefined()
    expect(res.body.emailVerificationRequired).toBe(true)
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
    await registerVerified(app, {
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

  describe('verificação de e-mail (EM.3.1)', () => {
    const payload = {
      name: 'Ana',
      email: 'ana@example.com',
      username: 'anaa',
      password: 'senha-forte-123',
    }

    it('cadastro enfileira o link; login antes de verificar dá 403 email_not_verified', async () => {
      const app = buildApp()
      await request(app).post('/auth/register').send(payload)

      expect(app.authMailer.verifications).toHaveLength(1)
      const wrong = await request(app)
        .post('/auth/login')
        .send({ email: payload.email, password: 'errada-123' })
      const pending = await request(app)
        .post('/auth/login')
        .send({ email: payload.email, password: payload.password })

      expect(wrong.status).toBe(401)
      expect(pending.status).toBe(403)
      expect(pending.body).toEqual({ error: 'email_not_verified' })
    })

    it('POST /auth/verify-email libera o login', async () => {
      const app = buildApp()
      await request(app).post('/auth/register').send(payload)
      const { token } = app.authMailer.verifications[0]

      const verify = await request(app).post('/auth/verify-email').send({ token })
      const login = await request(app)
        .post('/auth/login')
        .send({ email: payload.email, password: payload.password })

      expect(verify.status).toBe(200)
      expect(login.status).toBe(200)
      expect(typeof login.body.token).toBe('string')
    })

    it('POST /auth/verify-email: sem token 400, desconhecido 401, usado 410, vencido 410', async () => {
      const app = buildApp()
      await request(app).post('/auth/register').send(payload)
      const { token } = app.authMailer.verifications[0]

      expect((await request(app).post('/auth/verify-email').send({})).status).toBe(400)
      const unknown = await request(app).post('/auth/verify-email').send({ token: 'nao-existe' })
      expect(unknown.status).toBe(401)
      expect(unknown.body).toEqual({ error: 'invalid_token' })

      await request(app).post('/auth/verify-email').send({ token })
      const used = await request(app).post('/auth/verify-email').send({ token })
      expect(used.status).toBe(410)
      expect(used.body).toEqual({ error: 'token_used' })

      // Token vencido: força a data no repositório fake.
      const fresh = buildApp()
      await request(fresh).post('/auth/register').send(payload)
      fresh.authEmailTokens.rows[0].expiresAt = new Date(Date.now() - 1000)
      const expired = await request(fresh)
        .post('/auth/verify-email')
        .send({ token: fresh.authMailer.verifications[0].token })
      expect(expired.status).toBe(410)
      expect(expired.body).toEqual({ error: 'token_expired' })
    })

    it('POST /auth/resend-verification responde 202 igual para qualquer e-mail e reenvia só se pendente', async () => {
      const app = buildApp()
      await request(app).post('/auth/register').send(payload)

      const pending = await request(app)
        .post('/auth/resend-verification')
        .send({ email: payload.email })
      const missing = await request(app)
        .post('/auth/resend-verification')
        .send({ email: 'ninguem@example.com' })

      expect(pending.status).toBe(202)
      expect(missing.status).toBe(202)
      expect(missing.body).toEqual(pending.body)
      expect(app.authMailer.verifications).toHaveLength(2)

      // O link novo anulou o do cadastro.
      const [first, second] = app.authMailer.verifications
      expect(
        (await request(app).post('/auth/verify-email').send({ token: first.token })).status,
      ).toBe(410)
      expect(
        (await request(app).post('/auth/verify-email').send({ token: second.token })).status,
      ).toBe(200)

      await request(app).post('/auth/resend-verification').send({ email: payload.email })
      expect(app.authMailer.verifications).toHaveLength(2)
    })

    it('POST /auth/resend-verification recusa e-mail inválido com 400', async () => {
      const res = await request(buildApp())
        .post('/auth/resend-verification')
        .send({ email: 'nao-e-email' })
      expect(res.status).toBe(400)
    })
  })

  it('GET /auth/me exige token', async () => {
    const res = await request(buildApp()).get('/auth/me')
    expect(res.status).toBe(401)
  })

  it('GET /auth/me retorna o usuário autenticado', async () => {
    const app = buildApp()
    const token = await registerVerified(app, {
      name: 'Alexandre',
      email: 'me@example.com',
      username: 'meuser',
      password: 'senha-forte-123',
    })

    const res = await request(app).get('/auth/me').set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.user.email).toBe('me@example.com')
    expect(res.body.user.onboardingCompleted).toBe(false)
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

  it('GET /auth/google/callback redireciona com erro quando o Google não verificou o e-mail de uma conta existente', async () => {
    const app = buildApp({ googleEmailVerified: false })
    await request(app).post('/auth/register').send({
      name: 'Local',
      email: 'google@example.com',
      username: 'localuser',
      password: 'senha-forte-123',
    })

    const res = await request(app).get('/auth/google/callback?code=x')

    expect(res.status).toBe(302)
    expect(res.headers.location).toContain('/auth/callback#error=google_email_not_verified')
    expect(res.headers.location).not.toContain('token=')
  })

  describe('POST /auth/reauth', () => {
    async function registerAndLogin(app: ReturnType<typeof buildApp>) {
      return registerVerified(app, {
        name: 'Alexandre',
        email: 'reauth@example.com',
        username: 'reauth',
        password: 'senha-forte-123',
      })
    }

    it('devolve token novo quando a senha confere', async () => {
      const app = buildApp()
      const token = await registerAndLogin(app)
      const res = await request(app)
        .post('/auth/reauth')
        .set('Authorization', `Bearer ${token}`)
        .send({ password: 'senha-forte-123' })
      expect(res.status).toBe(200)
      expect(typeof res.body.token).toBe('string')
    })

    it('retorna 401 com senha incorreta', async () => {
      const app = buildApp()
      const token = await registerAndLogin(app)
      const res = await request(app)
        .post('/auth/reauth')
        .set('Authorization', `Bearer ${token}`)
        .send({ password: 'errada' })
      expect(res.status).toBe(401)
    })

    it('retorna 400 sem senha e 401 sem token', async () => {
      const app = buildApp()
      const token = await registerAndLogin(app)
      expect(
        (await request(app).post('/auth/reauth').set('Authorization', `Bearer ${token}`).send({}))
          .status,
      ).toBe(400)
      expect((await request(app).post('/auth/reauth').send({ password: 'x' })).status).toBe(401)
    })
  })

  describe('recuperação de senha (EM.2.2)', () => {
    async function registered(app: ReturnType<typeof buildApp>) {
      await request(app).post('/auth/register').send({
        name: 'Ana',
        email: 'ana@example.com',
        username: 'anaa',
        password: 'senha-antiga-1',
      })
    }

    it('POST /auth/forgot-password responde 202 igual para e-mail existente e inexistente', async () => {
      const app = buildApp()
      await registered(app)

      const existing = await request(app)
        .post('/auth/forgot-password')
        .send({ email: 'ana@example.com' })
      const missing = await request(app)
        .post('/auth/forgot-password')
        .send({ email: 'x@example.com' })

      expect(existing.status).toBe(202)
      expect(missing.status).toBe(202)
      expect(missing.body).toEqual(existing.body)
      expect(app.authMailer.resets).toHaveLength(1)
    })

    it('POST /auth/forgot-password recusa e-mail inválido com 400', async () => {
      const res = await request(buildApp())
        .post('/auth/forgot-password')
        .send({ email: 'nao-e-email' })

      expect(res.status).toBe(400)
    })

    it('POST /auth/reset-password troca a senha, e o login passa a valer só com a nova', async () => {
      const app = buildApp()
      await registered(app)
      await request(app).post('/auth/forgot-password').send({ email: 'ana@example.com' })
      const { token } = app.authMailer.resets[0]

      const reset = await request(app)
        .post('/auth/reset-password')
        .send({ token, newPassword: 'senha-nova-123' })
      const oldLogin = await request(app)
        .post('/auth/login')
        .send({ email: 'ana@example.com', password: 'senha-antiga-1' })
      const newLogin = await request(app)
        .post('/auth/login')
        .send({ email: 'ana@example.com', password: 'senha-nova-123' })

      expect(reset.status).toBe(200)
      expect(oldLogin.status).toBe(401)
      expect(newLogin.status).toBe(200)
    })

    it('POST /auth/reset-password recusa senha curta com 400 sem gastar o token', async () => {
      const app = buildApp()
      await registered(app)
      await request(app).post('/auth/forgot-password').send({ email: 'ana@example.com' })
      const { token } = app.authMailer.resets[0]

      const short = await request(app)
        .post('/auth/reset-password')
        .send({ token, newPassword: 'curta' })
      const ok = await request(app)
        .post('/auth/reset-password')
        .send({ token, newPassword: 'senha-nova-123' })

      expect(short.status).toBe(400)
      expect(ok.status).toBe(200)
    })

    it('POST /auth/reset-password: token desconhecido 401, usado 410', async () => {
      const app = buildApp()
      await registered(app)
      await request(app).post('/auth/forgot-password').send({ email: 'ana@example.com' })
      const { token } = app.authMailer.resets[0]
      const body = { token, newPassword: 'senha-nova-123' }

      const unknown = await request(app)
        .post('/auth/reset-password')
        .send({ token: 'nao-existe', newPassword: 'senha-nova-123' })
      await request(app).post('/auth/reset-password').send(body)
      const used = await request(app).post('/auth/reset-password').send(body)

      expect(unknown.status).toBe(401)
      expect(unknown.body).toEqual({ error: 'invalid_token' })
      expect(used.status).toBe(410)
      expect(used.body).toEqual({ error: 'token_used' })
    })

    it('POST /auth/reset-password: token expirado devolve 410 token_expired', async () => {
      const app = buildApp()
      await registered(app)
      await request(app).post('/auth/forgot-password').send({ email: 'ana@example.com' })
      const { token } = app.authMailer.resets[0]
      app.authEmailTokens.rows.find((row) => row.kind === 'password_reset')!.expiresAt = new Date(
        Date.now() - 1000,
      )

      const res = await request(app)
        .post('/auth/reset-password')
        .send({ token, newPassword: 'senha-nova-123' })

      expect(res.status).toBe(410)
      expect(res.body).toEqual({ error: 'token_expired' })
    })
  })
})
