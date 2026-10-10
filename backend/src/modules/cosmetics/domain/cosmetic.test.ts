import { describe, expect, it } from 'vitest'
import { NO_COSMETICS, resolveDisplay, type CosmeticItem } from './cosmetic'

const catalog: CosmeticItem[] = [
  { key: 'frame_aurora', kind: 'frame', name: 'Aurora', description: '', sortOrder: 1 },
  {
    key: 'title_paciente',
    kind: 'title',
    name: 'Investidor Paciente',
    description: '',
    sortOrder: 1,
  },
]

describe('resolveDisplay', () => {
  it('PRO mostra moldura (chave) e título (texto) escolhidos', () => {
    expect(
      resolveDisplay(true, { frame: 'frame_aurora', title: 'title_paciente' }, catalog),
    ).toEqual({ isPro: true, frame: 'frame_aurora', title: 'Investidor Paciente' })
  })

  it('PRO sem escolha mostra só o selo', () => {
    expect(resolveDisplay(true, { frame: null, title: null }, catalog)).toEqual({
      isPro: true,
      frame: null,
      title: null,
    })
  })

  it('quem não é PRO (cancelou) não mostra nada, mesmo com escolha guardada', () => {
    expect(
      resolveDisplay(false, { frame: 'frame_aurora', title: 'title_paciente' }, catalog),
    ).toEqual(NO_COSMETICS)
  })

  it('item fora do catálogo ou de outro tipo é ignorado', () => {
    expect(
      resolveDisplay(true, { frame: 'title_paciente', title: 'frame_aurora' }, catalog),
    ).toEqual({ isPro: true, frame: null, title: null })
    expect(resolveDisplay(true, { frame: 'sumiu', title: null }, catalog).frame).toBeNull()
  })
})
