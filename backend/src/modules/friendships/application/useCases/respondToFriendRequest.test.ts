import { beforeEach, describe, expect, it } from 'vitest'
import { FriendshipNotFoundError, NotAuthorizedError } from '../../domain/errors'
import { createFakeFriendRequestMailer } from '../../test/fakes/fakeFriendRequestMailer'
import { createFakeFriendshipRepository } from '../../test/fakes/fakeFriendshipRepository'
import { RespondToFriendRequestUseCase } from './respondToFriendRequest'

describe('RespondToFriendRequestUseCase', () => {
  let friendshipRepository: ReturnType<typeof createFakeFriendshipRepository>
  let mailer: ReturnType<typeof createFakeFriendRequestMailer>
  let useCase: RespondToFriendRequestUseCase

  beforeEach(() => {
    friendshipRepository = createFakeFriendshipRepository()
    mailer = createFakeFriendRequestMailer()
    useCase = new RespondToFriendRequestUseCase(friendshipRepository, mailer)
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

  describe('aviso por e-mail (EM.6.2)', () => {
    it('aceitar avisa quem pediu', async () => {
      const created = await friendshipRepository.create('u-alice', 'u-bob')

      await useCase.execute({ friendshipId: created.id, userId: 'u-bob' })

      expect(mailer.accepted).toEqual([{ requesterId: 'u-alice', accepterId: 'u-bob' }])
    })

    it('aceitar de novo não reenvia (idempotente)', async () => {
      const created = await friendshipRepository.create('u-alice', 'u-bob')
      await useCase.execute({ friendshipId: created.id, userId: 'u-bob' })

      await useCase.execute({ friendshipId: created.id, userId: 'u-bob' })

      expect(mailer.accepted).toHaveLength(1)
    })

    it('quem não é o destinatário não dispara aviso', async () => {
      const created = await friendshipRepository.create('u-alice', 'u-bob')

      await expect(
        useCase.execute({ friendshipId: created.id, userId: 'u-alice' }),
      ).rejects.toThrow(NotAuthorizedError)

      expect(mailer.accepted).toEqual([])
    })

    it('falha ao enfileirar o e-mail não desfaz o aceite', async () => {
      mailer.failWith(new Error('outbox fora do ar'))
      const created = await friendshipRepository.create('u-alice', 'u-bob')

      const result = await useCase.execute({ friendshipId: created.id, userId: 'u-bob' })

      expect(result.status).toBe('accepted')
    })
  })
})
