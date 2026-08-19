import { describe, expect, it } from 'vitest'
import { UserNotFoundError } from '../../domain/errors'
import { createFakeUserRepository } from '../../test/fakes/fakeUserRepository'
import { GetCurrentUserUseCase } from './getCurrentUser'

describe('GetCurrentUserUseCase', () => {
  it('retorna o usuário quando existe', async () => {
    const userRepository = createFakeUserRepository()
    const created = await userRepository.createUser({
      name: 'Alexandre',
      email: 'a@example.com',
      username: 'alexandre',
      passwordHash: null,
    })
    const useCase = new GetCurrentUserUseCase(userRepository)

    const user = await useCase.execute({ userId: created.id })
    expect(user.id).toBe(created.id)
  })

  it('lança UserNotFoundError quando o id não existe', async () => {
    const useCase = new GetCurrentUserUseCase(createFakeUserRepository())
    await expect(useCase.execute({ userId: 'inexistente' })).rejects.toBeInstanceOf(
      UserNotFoundError,
    )
  })
})
