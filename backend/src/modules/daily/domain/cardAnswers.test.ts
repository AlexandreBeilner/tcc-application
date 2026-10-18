import { describe, expect, it } from 'vitest'
import { evaluateChoice, evaluateTimelineOrder } from './cardAnswers'

describe('evaluateChoice', () => {
  it.each([
    [2, 2, 4, { ok: true, correct: true }],
    [0, 2, 4, { ok: true, correct: false }],
    [4, 2, 4, { ok: false, reason: 'invalid_choice' }],
    [-1, 2, 4, { ok: false, reason: 'invalid_choice' }],
    [1.5, 2, 4, { ok: false, reason: 'invalid_choice' }],
  ])('escolha %s (certa %s de %s)', (chosen, correct, count, expected) => {
    expect(evaluateChoice(chosen, correct, count)).toEqual(expected)
  })
})

describe('evaluateTimelineOrder', () => {
  const events = [
    { id: 'real', year: 1994 },
    { id: 'collor', year: 1990 },
    { id: 'crise', year: 2008 },
    { id: 'joesley', year: 2017 },
  ]

  it('ordem cronológica certa', () => {
    expect(evaluateTimelineOrder(['collor', 'real', 'crise', 'joesley'], events)).toEqual({
      ok: true,
      correct: true,
      positionHits: [true, true, true, true],
    })
  })

  it('ordem errada marca as posições certas', () => {
    expect(evaluateTimelineOrder(['real', 'collor', 'crise', 'joesley'], events)).toEqual({
      ok: true,
      correct: false,
      positionHits: [false, false, true, true],
    })
  })

  it.each([
    ['faltando item', ['collor', 'real', 'crise']],
    ['id repetido', ['collor', 'collor', 'crise', 'joesley']],
    ['id desconhecido', ['collor', 'real', 'crise', 'outro']],
    ['item a mais', ['collor', 'real', 'crise', 'joesley', 'real']],
  ])('inválida: %s', (_label, ids) => {
    expect(evaluateTimelineOrder(ids, events)).toEqual({ ok: false, reason: 'invalid_order' })
  })
})
