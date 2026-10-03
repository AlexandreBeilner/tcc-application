import { describe, expect, it } from 'vitest'
import { InvalidCredentialsError } from '../../domain/errors'
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
    tokenIssuer,
    createFakeAccountProvisioner(),
  )
  const loginUser = new LoginUserUseCase(userRepository, passwordHasher, tokenIssuer)
  return { registerUser, loginUser }
}

describe('LoginUserUseCase', () => {
  it('emite token com credenciais corretas', async () => {
    const { registerUser, loginUser } = build()
    await registerUser.execute({
      name: 'Alexandre',
      email: 'login@example.com',
      username: 'loginuser',
      password: 'senha-forte-123',
    })

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
      })
      const user = await userRepository.createUser({
        name: 'Comum',
        email: 'comum@example.com',
        username: 'comum',
        passwordHash: await passwordHasher.hash('senha-forte-123'),
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
})
