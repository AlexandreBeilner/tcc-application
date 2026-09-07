import { describe, expect, it } from 'vitest'
import { createFakeFriendGraphReader } from '../../test/fakes/fakeFriendGraphReader'
import { createFakeSocialFeedEventRepository } from '../../test/fakes/fakeSocialFeedEventRepository'
import { createFakeUserDirectory } from '../../test/fakes/fakeUserDirectory'
import { ListFeedForUserUseCase } from './listFeedForUser'

describe('ListFeedForUserUseCase', () => {
  it('lista eventos só de amigos aceitos, com username/nome resolvidos', async () => {
    const repository = createFakeSocialFeedEventRepository()
    await repository.record('friend-1', 'track_completed', 1)
    await repository.record('stranger', 'track_completed', 2)

    const useCase = new ListFeedForUserUseCase(
      createFakeFriendGraphReader({ 'user-1': ['friend-1'] }),
      repository,
      createFakeUserDirectory([
        { id: 'friend-1', username: 'amigo1', name: 'Amigo Um', avatarUrl: null },
      ]),
    )

    const feed = await useCase.execute({ userId: 'user-1' })

    expect(feed).toEqual([
      expect.objectContaining({
        userId: 'friend-1',
        username: 'amigo1',
        name: 'Amigo Um',
        trackNumber: 1,
        type: 'track_completed',
      }),
    ])
  })

  it('usuário sem amigos aceitos recebe feed vazio, sem consultar eventos de estranhos', async () => {
    const repository = createFakeSocialFeedEventRepository()
    await repository.record('someone-else', 'track_completed', 1)

    const useCase = new ListFeedForUserUseCase(
      createFakeFriendGraphReader({}),
      repository,
      createFakeUserDirectory(),
    )

    const feed = await useCase.execute({ userId: 'user-sem-amigos' })

    expect(feed).toEqual([])
  })

  it('nenhum item do feed carrega patrimônio/rentabilidade', async () => {
    const repository = createFakeSocialFeedEventRepository()
    await repository.record('friend-1', 'track_completed', 1)

    const useCase = new ListFeedForUserUseCase(
      createFakeFriendGraphReader({ 'user-1': ['friend-1'] }),
      repository,
      createFakeUserDirectory([
        { id: 'friend-1', username: 'amigo1', name: 'Amigo Um', avatarUrl: null },
      ]),
    )

    const [item] = await useCase.execute({ userId: 'user-1' })

    expect(Object.keys(item).sort()).toEqual(
      ['avatarUrl', 'name', 'occurredAt', 'trackNumber', 'type', 'userId', 'username'].sort(),
    )
  })
})
