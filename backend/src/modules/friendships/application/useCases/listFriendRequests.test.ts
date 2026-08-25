import { describe, expect, it } from 'vitest'
import { createFakeFriendshipRepository } from '../../test/fakes/fakeFriendshipRepository'
import { createFakeUserDirectory } from '../../test/fakes/fakeUserDirectory'
import { ListFriendRequestsUseCase } from './listFriendRequests'

const alice = { id: 'u-alice', username: 'alice', name: 'Alice' }
const bob = { id: 'u-bob', username: 'bob', name: 'Bob' }
const carol = { id: 'u-carol', username: 'carol', name: 'Carol' }

describe('ListFriendRequestsUseCase', () => {
  it('separa solicitações recebidas de enviadas', async () => {
    const friendshipRepository = createFakeFriendshipRepository()
    const userDirectory = createFakeUserDirectory([alice, bob, carol])
    const useCase = new ListFriendRequestsUseCase(friendshipRepository, userDirectory)

    await friendshipRepository.create(bob.id, alice.id) // recebida por alice
    await friendshipRepository.create(alice.id, carol.id) // enviada por alice

    const result = await useCase.execute({ userId: alice.id })

    expect(result.received).toHaveLength(1)
    expect(result.received[0].username).toBe('bob')
    expect(result.sent).toHaveLength(1)
    expect(result.sent[0].username).toBe('carol')
  })
})
