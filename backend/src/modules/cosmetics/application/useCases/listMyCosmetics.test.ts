import { describe, expect, it } from 'vitest'
import {
  createFakeCatalog,
  createFakeMembership,
  createFakeSelections,
} from '../../test/fakes/fakes'
import { ListMyCosmeticsUseCase } from './listMyCosmetics'

describe('ListMyCosmeticsUseCase', () => {
  it('PRO vê catálogo, escolha e como os outros o veem', async () => {
    const useCase = new ListMyCosmeticsUseCase(
      createFakeCatalog(),
      createFakeSelections({ u: { frame: 'frame_aurora', title: null } }),
      createFakeMembership(['u']),
    )
    const result = await useCase.execute('u')
    expect(result.isPro).toBe(true)
    expect(result.catalog).toHaveLength(3)
    expect(result.selection).toEqual({ frame: 'frame_aurora', title: null })
    expect(result.display).toEqual({ isPro: true, frame: 'frame_aurora', title: null })
  })

  it('quem cancelou vê a escolha arquivada, mas os outros não veem nada', async () => {
    const useCase = new ListMyCosmeticsUseCase(
      createFakeCatalog(),
      createFakeSelections({ u: { frame: 'frame_aurora', title: null } }),
      createFakeMembership([]),
    )
    const result = await useCase.execute('u')
    expect(result.isPro).toBe(false)
    expect(result.selection.frame).toBe('frame_aurora')
    expect(result.display).toEqual({ isPro: false, frame: null, title: null })
  })
})
