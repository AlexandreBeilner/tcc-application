import { describe, expect, it } from 'vitest'
import { resolveDisplay, type CosmeticItem } from './cosmetic'

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
  it('mostra moldura (chave) e título (texto) escolhidos', () => {
    expect(resolveDisplay({ frame: 'frame_aurora', title: 'title_paciente' }, catalog)).toEqual({
      frame: 'frame_aurora',
      title: 'Investidor Paciente',
    })
  })

  it('sem escolha não mostra nada', () => {
    expect(resolveDisplay({ frame: null, title: null }, catalog)).toEqual({
      frame: null,
      title: null,
    })
  })

  it('item fora do catálogo ou de outro tipo é ignorado', () => {
    expect(resolveDisplay({ frame: 'title_paciente', title: 'frame_aurora' }, catalog)).toEqual({
      frame: null,
      title: null,
    })
    expect(resolveDisplay({ frame: 'sumiu', title: null }, catalog).frame).toBeNull()
  })
})
