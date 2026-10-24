import { describe, expect, it } from 'vitest'
import { CosmeticItemNotFoundError, CosmeticLockedError } from '../../domain/errors'
import { createFakeCatalog, createFakeSelections } from '../../test/fakes/fakes'
import { EquipCosmeticUseCase } from './equipCosmetic'
import { UnequipCosmeticUseCase } from './unequipCosmetic'

function build() {
  const selections = createFakeSelections()
  return {
    selections,
    equip: new EquipCosmeticUseCase(createFakeCatalog(), selections),
    unequip: new UnequipCosmeticUseCase(selections),
  }
}

describe('EquipCosmeticUseCase', () => {
  it('equipa moldura e título, um por espaço', async () => {
    const { equip, selections } = build()
    await equip.execute({ userId: 'pro', kind: 'frame', itemKey: 'frame_aurora' })
    await equip.execute({ userId: 'pro', kind: 'title', itemKey: 'title_paciente' })
    await equip.execute({ userId: 'pro', kind: 'frame', itemKey: 'frame_oceano' })
    expect(selections.rows.get('pro')).toEqual({ frame: 'frame_oceano', title: 'title_paciente' })
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
  it('qualquer pessoa tira um item', async () => {
    const { unequip, selections } = build()
    selections.rows.set('ex', { frame: 'frame_aurora', title: 'title_paciente' })
    await unequip.execute('ex', 'frame')
    expect(selections.rows.get('ex')).toEqual({ frame: null, title: 'title_paciente' })
  })
})

describe('EquipCosmeticUseCase com título liberado por indicações', () => {
  const lockedCatalog = createFakeCatalog([
    {
      key: 'title_mensageiro',
      kind: 'title',
      name: 'Mensageiro',
      description: '',
      sortOrder: 90,
      unlockReferrals: 5,
    },
  ])

  function setup(referralCount: number) {
    const selections = createFakeSelections()
    return {
      selections,
      equip: new EquipCosmeticUseCase(lockedCatalog, selections, {
        qualifiedCount: async () => referralCount,
      }),
    }
  }

  it('recusa enquanto faltam indicações válidas', async () => {
    const { equip, selections } = setup(4)
    await expect(
      equip.execute({ userId: 'pro', kind: 'title', itemKey: 'title_mensageiro' }),
    ).rejects.toBeInstanceOf(CosmeticLockedError)
    expect(selections.rows.size).toBe(0)
  })

  it('libera ao alcançar o número de indicações', async () => {
    const { equip, selections } = setup(5)
    await equip.execute({ userId: 'pro', kind: 'title', itemKey: 'title_mensageiro' })
    expect(selections.rows.get('pro')?.title).toBe('title_mensageiro')
  })
})
