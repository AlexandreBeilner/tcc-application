import { describe, expect, it } from 'vitest'
import { InvalidCredentialsError, UserNotFoundError } from '../../domain/errors'
import { createFakeAdminSessionAuditor } from '../../test/fakes/fakeAdminSessionAuditor'
import { createFakePasswordHasher } from '../../test/fakes/fakePasswordHasher'
import { createFakeTokenIssuer } from '../../test/fakes/fakeTokenIssuer'
import { createFakeUserRepository } from '../../test/fakes/fakeUserRepository'
import { ReauthenticateUseCase } from './reauthenticate'

async function build(role: 'admin' | 'user' = 'admin', withPassword = true) {
  const userRepository = createFakeUserRepository()
  const passwordHasher = createFakePasswordHasher()
  const tokenIssuer = createFakeTokenIssuer()
  const sessionAuditor = createFakeAdminSessionAuditor()
  const user = await userRepository.createUser({
    name: 'Fulano',
    email: 'fulano@example.com',
    username: 'fulano',
    passwordHash: withPassword ? await passwordHasher.hash('senha-forte-123') : null,
    role,
  })
  const useCase = new ReauthenticateUseCase(
    userRepository,
    passwordHasher,
    tokenIssuer,
    sessionAuditor,
  )
  return { useCase, user, tokenIssuer, sessionAuditor }
}

describe('ReauthenticateUseCase', () => {
  it('devolve token com authTime fresco quando a senha confere', async () => {
    const { useCase, user, tokenIssuer } = await build()
    const before = Math.floor(Date.now() / 1000)

    const { token } = await useCase.execute({ userId: user.id, password: 'senha-forte-123' })

    expect(tokenIssuer.verify(token).authTime).toBeGreaterThanOrEqual(before)
  })

  it('rejeita senha incorreta e registra a falha de admin', async () => {
    const { useCase, user, sessionAuditor } = await build()
    await expect(useCase.execute({ userId: user.id, password: 'errada' })).rejects.toBeInstanceOf(
      InvalidCredentialsError,
    )
    expect(sessionAuditor.events).toEqual([{ adminId: user.id, kind: 'reauth_failed' }])
  })

  it('registra reautenticação bem-sucedida de admin', async () => {
    const { useCase, user, sessionAuditor } = await build()
    await useCase.execute({ userId: user.id, password: 'senha-forte-123' })
    expect(sessionAuditor.events).toEqual([{ adminId: user.id, kind: 'reauth' }])
  })

  it('não audita usuário comum', async () => {
    const { useCase, user, sessionAuditor } = await build('user')
    await useCase.execute({ userId: user.id, password: 'senha-forte-123' })
    expect(sessionAuditor.events).toEqual([])
  })

  it('recusa conta sem senha local', async () => {
    const { useCase, user } = await build('admin', false)
    await expect(useCase.execute({ userId: user.id, password: 'qualquer' })).rejects.toBeInstanceOf(
      InvalidCredentialsError,
    )
  })

  it('falha quando o usuário não existe', async () => {
    const { useCase } = await build()
    await expect(useCase.execute({ userId: 'inexistente', password: 'x' })).rejects.toBeInstanceOf(
      UserNotFoundError,
    )
  })
})
