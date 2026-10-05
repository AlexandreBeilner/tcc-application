import { describe, expect, it } from 'vitest'
import { createFakeUserRepository } from '../../test/fakes/fakeUserRepository'
import { UserSessionGuard } from './userSessionGuard'

async function build() {
  const userRepository = createFakeUserRepository()
  const user = await userRepository.createUser({
    name: 'Fulano',
    email: 'fulano@example.com',
    username: 'fulano',
    passwordHash: null,
  })
  return { userRepository, user, guard: new UserSessionGuard(userRepository) }
}

describe('UserSessionGuard', () => {
  it('aceita conta ativa com a versão de token atual', async () => {
    const { guard, user } = await build()
    expect(await guard.check(user.id, 0)).toBe('ok')
  })

  it('recusa conta suspensa mesmo com token da versão atual', async () => {
    const { guard, user, userRepository } = await build()
    await userRepository.updateUser(user.id, { status: 'suspended' })
    expect(await guard.check(user.id, 0)).toBe('suspended')
  })

  it('recusa token de versão antiga depois de revogar as sessões', async () => {
    const { guard, user, userRepository } = await build()
    await userRepository.revokeSessions(user.id)
    expect(await guard.check(user.id, 0)).toBe('revoked')
    expect(await guard.check(user.id, 1)).toBe('ok')
  })

  it('trata usuário inexistente como sessão revogada', async () => {
    const { guard } = await build()
    expect(await guard.check('nao-existe', 0)).toBe('revoked')
  })
})
