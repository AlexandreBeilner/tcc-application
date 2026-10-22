import { describe, expect, it } from 'vitest'
import { CARDS_PER_GAME, CARD_TYPES, isCardType } from './cards'
import { calculateDailyXp } from './xp'

describe('calculateDailyXp', () => {
  it.each([
    [0, 20],
    [1, 35],
    [2, 50],
  ])('%s cartões certos => %s XP', (correct, xp) => {
    expect(calculateDailyXp(correct)).toBe(xp)
  })

  it.each([-1, 3, 1.5, Number.NaN])('recusa %s', (n) => {
    expect(() => calculateDailyXp(n)).toThrow(RangeError)
  })
})

describe('cartões', () => {
  it('são dois (DI18)', () => {
    expect(CARD_TYPES).toEqual(['word', 'trivia'])
    expect(CARDS_PER_GAME).toBe(2)
  })

  it('isCardType', () => {
    expect(isCardType('word')).toBe(true)
    expect(isCardType('mais_ou_menos')).toBe(false)
    expect(isCardType('timeline')).toBe(false)
    expect(isCardType(null)).toBe(false)
  })
})
