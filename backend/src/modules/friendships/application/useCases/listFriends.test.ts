import { describe, expect, it } from 'vitest'
import { createFakeFriendshipRepository } from '../../test/fakes/fakeFriendshipRepository'
import { createFakeUserDirectory } from '../../test/fakes/fakeUserDirectory'
import { FRIENDS_PAGE_SIZE, ListFriendsUseCase } from './listFriends'

const alice = { id: 'u-alice', username: 'alice', name: 'Alice', avatarUrl: null }
const bob = { id: 'u-bob', username: 'bob', name: 'Bob', avatarUrl: null }
const carol = { id: 'u-carol', username: 'carol', name: 'Carol', avatarUrl: null }

describe('ListFriendsUseCase', () => {
  it('lista só amizades aceitas, dos dois lados da relação', async () => {
    const friendshipRepository = createFakeFriendshipRepository()
    const userDirectory = createFakeUserDirectory([alice, bob, carol])
    const useCase = new ListFriendsUseCase(friendshipRepository, userDirectory)

    const accepted = await friendshipRepository.create(alice.id, bob.id)
    await friendshipRepository.accept(accepted.id)
    // Solicitação pendente não deve aparecer na lista de amigos.
    await friendshipRepository.create(alice.id, carol.id)

    const result = await useCase.execute({ userId: alice.id, page: 1, sort: 'desc' })

    expect(result.items).toHaveLength(1)
    expect(result.items[0].userId).toBe(bob.id)
    expect(result.items[0].username).toBe('bob')
    expect(result.items[0].friendshipId).toBe(accepted.id)
    expect(result.totalEntries).toBe(1)
    expect(result.totalPages).toBe(1)
  })

  it('lista vazia quando não há amigos aceitos', async () => {
    const friendshipRepository = createFakeFriendshipRepository()
    const userDirectory = createFakeUserDirectory([alice])
    const useCase = new ListFriendsUseCase(friendshipRepository, userDirectory)

    const result = await useCase.execute({ userId: alice.id, page: 1, sort: 'desc' })

    expect(result.items).toEqual([])
    expect(result.totalEntries).toBe(0)
    expect(result.totalPages).toBe(1)
  })

  it('ordena por friendsSince, asc ou desc, e não depende da ordem do repositório (6.9.1)', async () => {
    const friendshipRepository = createFakeFriendshipRepository()
    const userDirectory = createFakeUserDirectory([alice, bob, carol])
    const useCase = new ListFriendsUseCase(friendshipRepository, userDirectory)

    const withBob = await friendshipRepository.create(alice.id, bob.id)
    await friendshipRepository.accept(withBob.id)
    await new Promise((resolve) => setTimeout(resolve, 5))
    const withCarol = await friendshipRepository.create(alice.id, carol.id)
    await friendshipRepository.accept(withCarol.id)

    const desc = await useCase.execute({ userId: alice.id, page: 1, sort: 'desc' })
    expect(desc.items.map((item) => item.username)).toEqual(['carol', 'bob'])

    const asc = await useCase.execute({ userId: alice.id, page: 1, sort: 'asc' })
    expect(asc.items.map((item) => item.username)).toEqual(['bob', 'carol'])
  })

  it('pagina e clampa página fora do intervalo (6.9.1)', async () => {
    const friendshipRepository = createFakeFriendshipRepository()
    const users = Array.from({ length: FRIENDS_PAGE_SIZE + 5 }, (_, index) => ({
      id: `u-friend-${index}`,
      username: `friend${index}`,
      name: `Friend ${index}`,
      avatarUrl: null,
    }))
    const userDirectory = createFakeUserDirectory([alice, ...users])
    const useCase = new ListFriendsUseCase(friendshipRepository, userDirectory)

    for (const user of users) {
      const created = await friendshipRepository.create(alice.id, user.id)
      await friendshipRepository.accept(created.id)
    }

    const firstPage = await useCase.execute({ userId: alice.id, page: 1, sort: 'desc' })
    expect(firstPage.items).toHaveLength(FRIENDS_PAGE_SIZE)
    expect(firstPage.totalEntries).toBe(users.length)
    expect(firstPage.totalPages).toBe(2)

    const clamped = await useCase.execute({ userId: alice.id, page: 99, sort: 'desc' })
    expect(clamped.page).toBe(2)
    expect(clamped.items).toHaveLength(5)
  })
})
