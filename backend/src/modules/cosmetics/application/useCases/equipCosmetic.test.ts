import { describe, expect, it } from 'vitest'
import { CosmeticItemNotFoundError } from '../../domain/errors'
import {
  createFakeCatalog,
  createFakeProAccess,
  createFakeSelections,
} from '../../test/fakes/fakes'
import { EquipCosmeticUseCase } from './equipCosmetic'
import { UnequipCosmeticUseCase } from './unequipCosmetic'

function build(proIds: string[] = ['pro']) {
  const selections = createFakeSelections()
  const access = createFakeProAccess(proIds)
  return {
    selections,
    equip: new EquipCosmeticUseCase(access, createFakeCatalog(), selections),
    unequip: new UnequipCosmeticUseCase(selections),
  }
}

describe('EquipCosmeticUseCase', () => {
  it('PRO equipa moldura e título, um por espaço', async () => {
    const { equip, selections } = build()
    await equip.execute({ userId: 'pro', kind: 'frame', itemKey: 'frame_aurora' })
    await equip.execute({ userId: 'pro', kind: 'title', itemKey: 'title_paciente' })
    await equip.execute({ userId: 'pro', kind: 'frame', itemKey: 'frame_oceano' })
    expect(selections.rows.get('pro')).toEqual({ frame: 'frame_oceano', title: 'title_paciente' })
  })

  it('sem PRO responde requer plano PRO e não grava', async () => {
    const { equip, selections } = build([])
    await expect(
      equip.execute({ userId: 'free', kind: 'frame', itemKey: 'frame_aurora' }),
    ).rejects.toMatchObject({ code: 'PRO_REQUIRED' })
    expect(selections.rows.size).toBe(0)
  })

  it('item inexistente ou do tipo errado é recusado', async () => {
    const { equip } = build()
    await expect(
      equip.execute({ userId: 'pro', kind: 'frame', itemKey: 'nao_existe' }),
    ).rejects.toBeInstanceOf(CosmeticItemNotFoundError)
    await expect(
      equip.execute({ userId: 'pro', kind: 'frame', itemKey: 'title_paciente' }),
    ).rejects.toBeInstanceOf(CosmeticItemNotFoundError)
  })
})

describe('UnequipCosmeticUseCase', () => {
  it('qualquer pessoa tira um item, mesmo sem PRO', async () => {
    const { unequip, selections } = build([])
    selections.rows.set('ex', { frame: 'frame_aurora', title: 'title_paciente' })
    await unequip.execute('ex', 'frame')
    expect(selections.rows.get('ex')).toEqual({ frame: null, title: 'title_paciente' })
  })
})
