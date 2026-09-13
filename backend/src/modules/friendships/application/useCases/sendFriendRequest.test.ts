import { beforeEach, describe, expect, it } from 'vitest'
import {
  AddresseeNotFoundError,
  FriendshipAlreadyExistsError,
  SelfFriendshipError,
} from '../../domain/errors'
import { createFakeFriendshipRepository } from '../../test/fakes/fakeFriendshipRepository'
import { createFakeUserDirectory } from '../../test/fakes/fakeUserDirectory'
import { SendFriendRequestUseCase } from './sendFriendRequest'

const alice = { id: 'u-alice', username: 'alice', name: 'Alice', avatarUrl: null }
const bob = { id: 'u-bob', username: 'bob', name: 'Bob', avatarUrl: null }

describe('SendFriendRequestUseCase', () => {
  let friendshipRepository: ReturnType<typeof createFakeFriendshipRepository>
  let userDirectory: ReturnType<typeof createFakeUserDirectory>
  let useCase: SendFriendRequestUseCase

  beforeEach(() => {
    friendshipRepository = createFakeFriendshipRepository()
    userDirectory = createFakeUserDirectory([alice, bob])
    useCase = new SendFriendRequestUseCase(friendshipRepository, userDirectory)
  })

  it('cria uma solicitação pendente', async () => {
    const friendship = await useCase.execute({
      requesterId: alice.id,
      addresseeUsername: bob.username,
    })

    expect(friendship.status).toBe('pending')
    expect(friendship.requesterId).toBe(alice.id)
    expect(friendship.addresseeId).toBe(bob.id)
  })

  it('rejeita destinatário inexistente', async () => {
    await expect(
      useCase.execute({ requesterId: alice.id, addresseeUsername: 'ninguem' }),
    ).rejects.toThrow(AddresseeNotFoundError)
  })

  it('rejeita solicitação de amizade a uma conta de bot (tarefa A.1, backlog-motor-mercado-realista) — bot nunca existe em `users`, então é indistinguível de um destinatário inexistente', async () => {
    await expect(
      useCase.execute({ requesterId: alice.id, addresseeUsername: 'bot_market_maker_1' }),
    ).rejects.toThrow(AddresseeNotFoundError)
  })

  it('rejeita auto-solicitação', async () => {
    await expect(
      useCase.execute({ requesterId: alice.id, addresseeUsername: alice.username }),
    ).rejects.toThrow(SelfFriendshipError)
  })

  it('rejeita solicitação duplicada na mesma direção', async () => {
    await useCase.execute({ requesterId: alice.id, addresseeUsername: bob.username })

    await expect(
      useCase.execute({ requesterId: alice.id, addresseeUsername: bob.username }),
    ).rejects.toThrow(FriendshipAlreadyExistsError)
  })

  it('rejeita solicitação quando já são amigos', async () => {
    const friendship = await useCase.execute({
      requesterId: alice.id,
      addresseeUsername: bob.username,
    })
    await friendshipRepository.accept(friendship.id)

    await expect(
      useCase.execute({ requesterId: alice.id, addresseeUsername: bob.username }),
    ).rejects.toThrow(FriendshipAlreadyExistsError)
  })

  it('aceita automaticamente um pedido mútuo (direção oposta já pendente)', async () => {
    await useCase.execute({ requesterId: bob.id, addresseeUsername: alice.username })

    const friendship = await useCase.execute({
      requesterId: alice.id,
      addresseeUsername: bob.username,
    })

    expect(friendship.status).toBe('accepted')
    expect(friendship.requesterId).toBe(bob.id)
    expect(friendship.addresseeId).toBe(alice.id)
  })
})
