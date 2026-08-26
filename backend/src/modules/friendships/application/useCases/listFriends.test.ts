import { describe, expect, it } from 'vitest'
import { createFakeFriendshipRepository } from '../../test/fakes/fakeFriendshipRepository'
import { createFakeUserDirectory } from '../../test/fakes/fakeUserDirectory'
import { ListFriendsUseCase } from './listFriends'

const alice = { id: 'u-alice', username: 'alice', name: 'Alice' }
const bob = { id: 'u-bob', username: 'bob', name: 'Bob' }
const carol = { id: 'u-carol', username: 'carol', name: 'Carol' }

describe('ListFriendsUseCase', () => {
  it('lista só amizades aceitas, dos dois lados da relação', async () => {
    const friendshipRepository = createFakeFriendshipRepository()
    const userDirectory = createFakeUserDirectory([alice, bob, carol])
    const useCase = new ListFriendsUseCase(friendshipRepository, userDirectory)

    const accepted = await friendshipRepository.create(alice.id, bob.id)
    await friendshipRepository.accept(accepted.id)
    // Solicitação pendente não deve aparecer na lista de amigos.
    await friendshipRepository.create(alice.id, carol.id)

    const friends = await useCase.execute({ userId: alice.id })

    expect(friends).toHaveLength(1)
    expect(friends[0].userId).toBe(bob.id)
    expect(friends[0].username).toBe('bob')
  })

  it('lista vazia quando não há amigos aceitos', async () => {
    const friendshipRepository = createFakeFriendshipRepository()
    const userDirectory = createFakeUserDirectory([alice])
    const useCase = new ListFriendsUseCase(friendshipRepository, userDirectory)

    const friends = await useCase.execute({ userId: alice.id })

    expect(friends).toEqual([])
  })
})
