import { describe, expect, it } from 'vitest'
import { createFakeFriendshipRepository } from '../../test/fakes/fakeFriendshipRepository'
import { createFakeUserDirectory } from '../../test/fakes/fakeUserDirectory'
import { FRIENDS_PAGE_SIZE } from './listFriends'
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

    const result = await useCase.execute({
      userId: alice.id,
      receivedPage: 1,
      sentPage: 1,
      sort: 'desc',
    })

    expect(result.received.items).toHaveLength(1)
    expect(result.received.items[0].username).toBe('bob')
    expect(result.received.totalEntries).toBe(1)
    expect(result.sent.items).toHaveLength(1)
    expect(result.sent.items[0].username).toBe('carol')
    expect(result.sent.totalEntries).toBe(1)
  })

  it('ordena por createdAt, asc ou desc, independente da ordem do repositório (6.9.1)', async () => {
    const friendshipRepository = createFakeFriendshipRepository()
    const userDirectory = createFakeUserDirectory([alice, bob, carol])
    const useCase = new ListFriendRequestsUseCase(friendshipRepository, userDirectory)

    await friendshipRepository.create(bob.id, alice.id)
    await new Promise((resolve) => setTimeout(resolve, 5))
    await friendshipRepository.create(carol.id, alice.id)

    const desc = await useCase.execute({
      userId: alice.id,
      receivedPage: 1,
      sentPage: 1,
      sort: 'desc',
    })
    expect(desc.received.items.map((item) => item.username)).toEqual(['carol', 'bob'])

    const asc = await useCase.execute({
      userId: alice.id,
      receivedPage: 1,
      sentPage: 1,
      sort: 'asc',
    })
    expect(asc.received.items.map((item) => item.username)).toEqual(['bob', 'carol'])
  })

  it('pagina recebidas e enviadas de forma independente (6.9.1)', async () => {
    const friendshipRepository = createFakeFriendshipRepository()
    const receivers = Array.from({ length: FRIENDS_PAGE_SIZE + 2 }, (_, index) => ({
      id: `u-receiver-${index}`,
      username: `receiver${index}`,
      name: `Receiver ${index}`,
    }))
    const userDirectory = createFakeUserDirectory([alice, ...receivers])
    const useCase = new ListFriendRequestsUseCase(friendshipRepository, userDirectory)

    for (const user of receivers) {
      await friendshipRepository.create(user.id, alice.id)
    }

    const firstPage = await useCase.execute({
      userId: alice.id,
      receivedPage: 1,
      sentPage: 1,
      sort: 'desc',
    })
    expect(firstPage.received.items).toHaveLength(FRIENDS_PAGE_SIZE)
    expect(firstPage.received.totalPages).toBe(2)
    expect(firstPage.sent.items).toHaveLength(0)
    expect(firstPage.sent.totalPages).toBe(1)

    const secondReceivedPage = await useCase.execute({
      userId: alice.id,
      receivedPage: 2,
      sentPage: 1,
      sort: 'desc',
    })
    expect(secondReceivedPage.received.items).toHaveLength(2)
  })
})
