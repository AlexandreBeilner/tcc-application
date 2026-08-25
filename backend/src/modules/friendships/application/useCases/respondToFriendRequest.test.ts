import { beforeEach, describe, expect, it } from 'vitest'
import { FriendshipNotFoundError, NotAuthorizedError } from '../../domain/errors'
import { createFakeFriendshipRepository } from '../../test/fakes/fakeFriendshipRepository'
import { RespondToFriendRequestUseCase } from './respondToFriendRequest'

describe('RespondToFriendRequestUseCase', () => {
  let friendshipRepository: ReturnType<typeof createFakeFriendshipRepository>
  let useCase: RespondToFriendRequestUseCase

  beforeEach(() => {
    friendshipRepository = createFakeFriendshipRepository()
    useCase = new RespondToFriendRequestUseCase(friendshipRepository)
  })

  it('destinatário aceita a solicitação pendente', async () => {
    const created = await friendshipRepository.create('u-alice', 'u-bob')

    const result = await useCase.execute({ friendshipId: created.id, userId: 'u-bob' })

    expect(result.status).toBe('accepted')
    expect(result.respondedAt).not.toBeNull()
  })

  it('é idempotente ao aceitar duas vezes', async () => {
    const created = await friendshipRepository.create('u-alice', 'u-bob')
    await useCase.execute({ friendshipId: created.id, userId: 'u-bob' })

    const result = await useCase.execute({ friendshipId: created.id, userId: 'u-bob' })

    expect(result.status).toBe('accepted')
  })

  it('rejeita quando quem chama não é o destinatário', async () => {
    const created = await friendshipRepository.create('u-alice', 'u-bob')

    await expect(useCase.execute({ friendshipId: created.id, userId: 'u-alice' })).rejects.toThrow(
      NotAuthorizedError,
    )
  })

  it('404 pra solicitação inexistente', async () => {
    await expect(useCase.execute({ friendshipId: 'nope', userId: 'u-bob' })).rejects.toThrow(
      FriendshipNotFoundError,
    )
  })
})
