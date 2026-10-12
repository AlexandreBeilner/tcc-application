import { describe, expect, it } from 'vitest'
import {
  AccountSuspendedError,
  EmailNotVerifiedError,
  InvalidCredentialsError,
} from '../../domain/errors'
import { createFakePasswordHasher } from '../../test/fakes/fakePasswordHasher'
import { createFakeTokenIssuer } from '../../test/fakes/fakeTokenIssuer'
import { createFakeAccountProvisioner } from '../../test/fakes/fakeAccountProvisioner'
import { createFakeUserRepository } from '../../test/fakes/fakeUserRepository'
import { createFakeAdminSessionAuditor } from '../../test/fakes/fakeAdminSessionAuditor'
import { RegisterUserUseCase } from './registerUser'
import { LoginUserUseCase } from './loginUser'

function build() {
  const userRepository = createFakeUserRepository()
  const passwordHasher = createFakePasswordHasher()
  const tokenIssuer = createFakeTokenIssuer()
  const registerUser = new RegisterUserUseCase(
    userRepository,
    passwordHasher,
    createFakeAccountProvisioner(),
    { sendToUser: async () => {} },
  )
  const loginUser = new LoginUserUseCase(userRepository, passwordHasher, tokenIssuer)
  // Cadastro novo nasce não verificado (D2); os testes que só querem logar confirmam o e-mail.
  async function verify(userId: string) {
    await userRepository.updateUser(userId, { emailVerifiedAt: new Date() })
  }
  return { registerUser, loginUser, userRepository, tokenIssuer, verify }
}

describe('LoginUserUseCase', () => {
  it('emite token com credenciais corretas', async () => {
    const { registerUser, loginUser, verify } = build()
    const { user } = await registerUser.execute({
      name: 'Alexandre',
      email: 'login@example.com',
      username: 'loginuser',
      password: 'senha-forte-123',
    })
    await verify(user.id)

    const result = await loginUser.execute({
      email: 'login@example.com',
      password: 'senha-forte-123',
    })
    expect(result.user.email).toBe('login@example.com')
    expect(typeof result.token).toBe('string')
  })

  it('rejeita senha incorreta', async () => {
    const { registerUser, loginUser } = build()
    await registerUser.execute({
      name: 'Alexandre',
      email: 'wrongpass@example.com',
      username: 'wrongpass',
      password: 'senha-forte-123',
    })

    await expect(
      loginUser.execute({ email: 'wrongpass@example.com', password: 'outra-senha' }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError)
  })

  describe('e-mail não verificado (D2)', () => {
    it('recusa conta não verificada só depois de a senha conferir', async () => {
      const { registerUser, loginUser } = build()
      await registerUser.execute({
        name: 'Alexandre',
        email: 'pendente@example.com',
        username: 'pendente',
        password: 'senha-forte-123',
      })

      await expect(
        loginUser.execute({ email: 'pendente@example.com', password: 'senha-forte-123' }),
      ).rejects.toBeInstanceOf(EmailNotVerifiedError)
      // Senha errada: mesmo erro genérico, sem revelar que a conta existe e está pendente.
      await expect(
        loginUser.execute({ email: 'pendente@example.com', password: 'errada' }),
      ).rejects.toBeInstanceOf(InvalidCredentialsError)
    })

    it('libera o login depois que o e-mail é verificado', async () => {
      const { registerUser, loginUser, verify } = build()
      const { user } = await registerUser.execute({
        name: 'Alexandre',
        email: 'ok@example.com',
        username: 'okuser',
        password: 'senha-forte-123',
      })
      await verify(user.id)

      const result = await loginUser.execute({
        email: 'ok@example.com',
        password: 'senha-forte-123',
      })
      expect(result.user.id).toBe(user.id)
    })
  })

  it('rejeita e-mail inexistente', async () => {
    const { loginUser } = build()
    await expect(
      loginUser.execute({ email: 'ninguem@example.com', password: 'senha-forte-123' }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError)
  })

  it('rejeita login por senha em conta só-OAuth (sem password hash)', async () => {
    const userRepository = createFakeUserRepository()
    await userRepository.createUser({
      name: 'Conta Google',
      email: 'oauth@example.com',
      username: 'oauthuser',
      passwordHash: null,
    })
    const loginUser = new LoginUserUseCase(
      userRepository,
      createFakePasswordHasher(),
      createFakeTokenIssuer(),
    )

    await expect(
      loginUser.execute({ email: 'oauth@example.com', password: 'qualquer-coisa' }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError)
  })

  describe('auditoria de sessão de administrador (N.22)', () => {
    async function buildWithAdmin() {
      const userRepository = createFakeUserRepository()
      const passwordHasher = createFakePasswordHasher()
      const sessionAuditor = createFakeAdminSessionAuditor()
      const loginUser = new LoginUserUseCase(
        userRepository,
        passwordHasher,
        createFakeTokenIssuer(),
        sessionAuditor,
      )
      const admin = await userRepository.createUser({
        name: 'Admin',
        email: 'admin@example.com',
        username: 'admin',
        passwordHash: await passwordHasher.hash('senha-forte-123'),
        role: 'admin',
        emailVerified: true,
      })
      const user = await userRepository.createUser({
        name: 'Comum',
        email: 'comum@example.com',
        username: 'comum',
        passwordHash: await passwordHasher.hash('senha-forte-123'),
        emailVerified: true,
      })
      return { loginUser, sessionAuditor, admin, user }
    }

    it('registra login e falha de admin', async () => {
      const { loginUser, sessionAuditor, admin } = await buildWithAdmin()
      await loginUser.execute({ email: 'admin@example.com', password: 'senha-forte-123' })
      await expect(
        loginUser.execute({ email: 'admin@example.com', password: 'errada' }),
      ).rejects.toBeInstanceOf(InvalidCredentialsError)
      expect(sessionAuditor.events).toEqual([
        { adminId: admin.id, kind: 'login' },
        { adminId: admin.id, kind: 'login_failed' },
      ])
    })

    it('não registra login de usuário comum', async () => {
      const { loginUser, sessionAuditor } = await buildWithAdmin()
      await loginUser.execute({ email: 'comum@example.com', password: 'senha-forte-123' })
      expect(sessionAuditor.events).toEqual([])
    })
  })

  describe('conta suspensa (N.16)', () => {
    it('recusa login com a senha certa e não revela a suspensão a quem erra a senha', async () => {
      const { registerUser, loginUser, userRepository } = build()
      const { user } = await registerUser.execute({
        name: 'Alexandre',
        email: 'susp@example.com',
        username: 'susp',
        password: 'senha-forte-123',
      })
      await userRepository.updateUser(user.id, { status: 'suspended', emailVerifiedAt: new Date() })

      await expect(
        loginUser.execute({ email: 'susp@example.com', password: 'senha-forte-123' }),
      ).rejects.toBeInstanceOf(AccountSuspendedError)
      await expect(
        loginUser.execute({ email: 'susp@example.com', password: 'errada' }),
      ).rejects.toBeInstanceOf(InvalidCredentialsError)
    })

    it('emite o token com a versão de sessão atual do usuário', async () => {
      const { registerUser, loginUser, userRepository, tokenIssuer } = build()
      const { user } = await registerUser.execute({
        name: 'Alexandre',
        email: 'ver@example.com',
        username: 'ver',
        password: 'senha-forte-123',
      })
      await userRepository.updateUser(user.id, { emailVerifiedAt: new Date() })
      await userRepository.revokeSessions(user.id)

      const { token } = await loginUser.execute({
        email: 'ver@example.com',
        password: 'senha-forte-123',
      })
      expect(tokenIssuer.verify(token).tokenVersion).toBe(1)
    })
  })
})
