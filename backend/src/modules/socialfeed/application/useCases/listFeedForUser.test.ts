import { describe, expect, it } from 'vitest'
import { createFakeFriendGraphReader } from '../../test/fakes/fakeFriendGraphReader'
import { createFakeSocialFeedEventRepository } from '../../test/fakes/fakeSocialFeedEventRepository'
import { createFakeUserDirectory } from '../../test/fakes/fakeUserDirectory'
import { ListFeedForUserUseCase } from './listFeedForUser'
import { RecordDuelResultUseCase } from './recordDuelResult'

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
      [
        'avatarUrl',
        'cosmetics',
        'duel',
        'name',
        'occurredAt',
        'trackNumber',
        'type',
        'userId',
        'username',
      ].sort(),
    )
  })

  it('amigo PRO aparece com selo, moldura e título', async () => {
    const repository = createFakeSocialFeedEventRepository()
    await repository.record('friend-1', 'track_completed', 1)
    const useCase = new ListFeedForUserUseCase(
      createFakeFriendGraphReader({ 'user-1': ['friend-1'] }),
      repository,
      createFakeUserDirectory([
        { id: 'friend-1', username: 'amigo1', name: 'Amigo Um', avatarUrl: null },
      ]),
      {
        findDisplays: async () =>
          new Map([['friend-1', { isPro: true, frame: 'frame_oceano', title: 'Mente Curiosa' }]]),
      },
    )

    const [item] = await useCase.execute({ userId: 'user-1' })

    expect(item.cosmetics).toEqual({ isPro: true, frame: 'frame_oceano', title: 'Mente Curiosa' })
  })

  it('resultado de duelo aparece como item do feed, só com nomes e desfecho', async () => {
    const repository = createFakeSocialFeedEventRepository()
    await new RecordDuelResultUseCase(repository).execute({
      userId: 'friend-1',
      kind: 'won',
      data: {
        duelId: 'd1',
        opponentUsername: 'rival',
        opponentName: 'Rival',
        reason: 'profitability',
      },
    })
    const useCase = new ListFeedForUserUseCase(
      createFakeFriendGraphReader({ 'user-1': ['friend-1'] }),
      repository,
      createFakeUserDirectory([
        { id: 'friend-1', username: 'amigo1', name: 'Amigo Um', avatarUrl: null },
      ]),
    )

    const [item] = await useCase.execute({ userId: 'user-1' })

    expect(item.type).toBe('duel_won')
    expect(item.trackNumber).toBeNull()
    expect(item.duel).toEqual({
      duelId: 'd1',
      opponentUsername: 'rival',
      opponentName: 'Rival',
      reason: 'profitability',
    })
  })
})
