import { describe, expect, it } from 'vitest'
import { evaluateChoice } from './cardAnswers'

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
