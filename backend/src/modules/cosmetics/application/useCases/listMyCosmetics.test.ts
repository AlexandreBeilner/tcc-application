import { describe, expect, it } from 'vitest'
import { createFakeCatalog, createFakeSelections } from '../../test/fakes/fakes'
import { ListMyCosmeticsUseCase } from './listMyCosmetics'

describe('ListMyCosmeticsUseCase', () => {
  it('mostra catálogo, escolha e como os outros veem a pessoa', async () => {
    const useCase = new ListMyCosmeticsUseCase(
      createFakeCatalog(),
      createFakeSelections({ u: { frame: 'frame_aurora', title: null } }),
    )
    const result = await useCase.execute('u')
    expect(result.catalog).toHaveLength(3)
    expect(result.selection).toEqual({ frame: 'frame_aurora', title: null })
    expect(result.display).toEqual({ frame: 'frame_aurora', title: null })
    expect(result.referralCount).toBe(0)
  })
})
