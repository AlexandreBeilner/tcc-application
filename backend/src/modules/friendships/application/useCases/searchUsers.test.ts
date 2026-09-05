import { describe, expect, it } from 'vitest'
import { createFakeUserDirectory } from '../../test/fakes/fakeUserDirectory'
import { SearchUsersUseCase } from './searchUsers'

const alice = { id: 'u-alice', username: 'alice', name: 'Alice', avatarUrl: null }
const alicia = { id: 'u-alicia', username: 'alicia', name: 'Alicia', avatarUrl: null }
const bob = { id: 'u-bob', username: 'bob', name: 'Bob', avatarUrl: null }

describe('SearchUsersUseCase', () => {
  it('busca por username, excluindo o próprio usuário', async () => {
    const userDirectory = createFakeUserDirectory([alice, alicia, bob])
    const useCase = new SearchUsersUseCase(userDirectory)

    const result = await useCase.execute({ userId: alice.id, query: 'ali' })

    expect(result.map((u) => u.id)).toEqual([alicia.id])
  })
})
