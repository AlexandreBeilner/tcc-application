import { describe, expect, it } from 'vitest'
import { createFakeFriendshipRepository } from '../../test/fakes/fakeFriendshipRepository'
import { ExportFriendshipsUseCase } from './exportFriendships'

describe('ExportFriendshipsUseCase', () => {
  it('junta amizades aceitas, pendentes recebidas e pendentes enviadas do usuário', async () => {
    const repository = createFakeFriendshipRepository()
    const accepted = await repository.create('u1', 'bob')
    await repository.accept(accepted.id)
    await repository.create('carol', 'u1') // pendente recebida
    await repository.create('u1', 'dave') // pendente enviada

    const useCase = new ExportFriendshipsUseCase(repository)
    const result = await useCase.execute({ userId: 'u1' })

    expect(result).toHaveLength(3)
    expect(result.map((f) => f.status).sort()).toEqual(['accepted', 'pending', 'pending'])
  })

  it('lista vazia pra usuário sem nenhuma amizade', async () => {
    const repository = createFakeFriendshipRepository()
    const useCase = new ExportFriendshipsUseCase(repository)

    expect(await useCase.execute({ userId: 'u1' })).toEqual([])
  })
})
