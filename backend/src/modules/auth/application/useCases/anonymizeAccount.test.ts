import { describe, expect, it } from 'vitest'
import { UserNotFoundError } from '../../domain/errors'
import { createFakeUserRepository } from '../../test/fakes/fakeUserRepository'
import { AnonymizeAccountUseCase } from './anonymizeAccount'

describe('AnonymizeAccountUseCase', () => {
  it('anonimiza nome/e-mail/username, remove a senha e desconecta identidades OAuth', async () => {
    const userRepository = createFakeUserRepository()
    const user = await userRepository.createUser({
      name: 'Alexandre',
      email: 'a@example.com',
      username: 'alexandreb',
      passwordHash: 'hashed:senha',
    })
    await userRepository.createIdentity({
      userId: user.id,
      providerName: 'google',
      providerAccountId: 'g-123',
    })
    const useCase = new AnonymizeAccountUseCase(userRepository)

    await useCase.execute({ userId: user.id })

    const updated = await userRepository.findById(user.id)
    expect(updated?.id).toBe(user.id) // mesma linha, não exclusão física
    expect(updated?.name).toBe('Usuário removido')
    expect(updated?.email).not.toBe('a@example.com')
    expect(updated?.username).not.toBe('alexandreb')
    expect(updated?.passwordHash).toBeNull()
    expect(await userRepository.listIdentitiesForUser(user.id)).toEqual([])
  })

  it('404 pra usuário inexistente', async () => {
    const userRepository = createFakeUserRepository()
    const useCase = new AnonymizeAccountUseCase(userRepository)

    await expect(useCase.execute({ userId: 'nope' })).rejects.toBeInstanceOf(UserNotFoundError)
  })
})
