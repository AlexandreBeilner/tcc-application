import { beforeEach, describe, expect, it } from 'vitest'
import { FriendshipNotFoundError, NotAuthorizedError } from '../../domain/errors'
import { createFakeFriendshipRepository } from '../../test/fakes/fakeFriendshipRepository'
import { RemoveFriendshipUseCase } from './removeFriendship'

describe('RemoveFriendshipUseCase', () => {
  let friendshipRepository: ReturnType<typeof createFakeFriendshipRepository>
  let useCase: RemoveFriendshipUseCase

  beforeEach(() => {
    friendshipRepository = createFakeFriendshipRepository()
    useCase = new RemoveFriendshipUseCase(friendshipRepository)
  })

  it('requerente cancela sua própria solicitação pendente', async () => {
    const created = await friendshipRepository.create('u-alice', 'u-bob')

    await useCase.execute({ friendshipId: created.id, userId: 'u-alice' })

    await expect(friendshipRepository.findById(created.id)).resolves.toBeUndefined()
  })

  it('destinatário recusa a solicitação pendente', async () => {
    const created = await friendshipRepository.create('u-alice', 'u-bob')

    await useCase.execute({ friendshipId: created.id, userId: 'u-bob' })

    await expect(friendshipRepository.findById(created.id)).resolves.toBeUndefined()
  })

  it('rejeita quem não é requerente nem destinatário', async () => {
    const created = await friendshipRepository.create('u-alice', 'u-bob')

    await expect(useCase.execute({ friendshipId: created.id, userId: 'u-carol' })).rejects.toThrow(
      NotAuthorizedError,
    )
  })

  it('404 pra solicitação inexistente', async () => {
    await expect(useCase.execute({ friendshipId: 'nope', userId: 'u-alice' })).rejects.toThrow(
      FriendshipNotFoundError,
    )
  })

  it('desfaz uma amizade já aceita (6.9.3)', async () => {
    const created = await friendshipRepository.create('u-alice', 'u-bob')
    await friendshipRepository.accept(created.id)

    await useCase.execute({ friendshipId: created.id, userId: 'u-alice' })

    await expect(friendshipRepository.findById(created.id)).resolves.toBeUndefined()
  })

  it('destinatário também pode desfazer uma amizade já aceita', async () => {
    const created = await friendshipRepository.create('u-alice', 'u-bob')
    await friendshipRepository.accept(created.id)

    await useCase.execute({ friendshipId: created.id, userId: 'u-bob' })

    await expect(friendshipRepository.findById(created.id)).resolves.toBeUndefined()
  })
})
