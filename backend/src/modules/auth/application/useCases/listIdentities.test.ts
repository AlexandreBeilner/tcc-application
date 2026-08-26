import { describe, expect, it } from 'vitest'
import { createFakeUserRepository } from '../../test/fakes/fakeUserRepository'
import { ListIdentitiesUseCase } from './listIdentities'

describe('ListIdentitiesUseCase', () => {
  it('lista os provedores conectados do usuário', async () => {
    const userRepository = createFakeUserRepository()
    const user = await userRepository.createUser({
      name: 'Alexandre',
      email: 'a@example.com',
      username: 'alexandreb',
      passwordHash: null,
    })
    await userRepository.createIdentity({
      userId: user.id,
      providerName: 'google',
      providerAccountId: 'g-123',
    })
    const useCase = new ListIdentitiesUseCase(userRepository)

    const result = await useCase.execute({ userId: user.id })

    expect(result).toEqual([
      {
        id: expect.any(String),
        userId: user.id,
        providerName: 'google',
        providerAccountId: 'g-123',
      },
    ])
  })

  it('lista vazia pra usuário sem nenhum provedor conectado', async () => {
    const userRepository = createFakeUserRepository()
    const user = await userRepository.createUser({
      name: 'Alexandre',
      email: 'a@example.com',
      username: 'alexandreb',
      passwordHash: 'hashed:senha',
    })
    const useCase = new ListIdentitiesUseCase(userRepository)

    expect(await useCase.execute({ userId: user.id })).toEqual([])
  })
})
