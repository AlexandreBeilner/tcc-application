import { describe, expect, it } from 'vitest'
import { decorateWithSeen } from './decorateSeen'

describe('decorateWithSeen', () => {
  it('marca seen: true só pros ids presentes no conjunto', () => {
    const events = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]

    const result = decorateWithSeen(events, new Set(['b']))

    expect(result).toEqual([
      { id: 'a', seen: false },
      { id: 'b', seen: true },
      { id: 'c', seen: false },
    ])
  })

  it('preserva os demais campos do evento', () => {
    const events = [{ id: 'a', title: 'título' }]

    const result = decorateWithSeen(events, new Set())

    expect(result).toEqual([{ id: 'a', title: 'título', seen: false }])
  })

  it('lista vazia devolve lista vazia', () => {
    expect(decorateWithSeen([], new Set(['a']))).toEqual([])
  })
})
