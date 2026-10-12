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

  it('conta de bot nunca aparece na busca (tarefa A.1, backlog-motor-mercado-realista) — bot só existe em `accounts` no motor, nunca em `users` aqui', async () => {
    // Sem nenhum bot no seed — reflete a realidade de produção: bot nunca
    // passa pelo fluxo de cadastro que popula `users`. A busca por um termo
    // que casaria com a convenção de nome de bot não pode retornar nada.
    const userDirectory = createFakeUserDirectory([alice, bob])
    const useCase = new SearchUsersUseCase(userDirectory)

    const result = await useCase.execute({ userId: alice.id, query: 'bot_market_maker' })

    expect(result).toEqual([])
  })

  it('resultado da busca traz o cosmético de quem é PRO e nada para os outros', async () => {
    const useCase = new SearchUsersUseCase(createFakeUserDirectory([alice, alicia, bob]), {
      findDisplays: async () =>
        new Map([[alicia.id, { isPro: true, frame: 'frame_ambar', title: null }]]),
    })

    const result = await useCase.execute({ userId: bob.id, query: 'ali' })

    expect(result.find((u) => u.id === alicia.id)?.cosmetics).toEqual({
      isPro: true,
      frame: 'frame_ambar',
      title: null,
    })
    expect(result.find((u) => u.id === alice.id)?.cosmetics).toEqual({
      isPro: false,
      frame: null,
      title: null,
    })
  })
})
