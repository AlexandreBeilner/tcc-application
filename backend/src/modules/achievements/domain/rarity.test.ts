import { describe, expect, it } from 'vitest'
import { isRareAchievement, RARE_MIN_POPULATION } from './rarity'

describe('isRareAchievement', () => {
  it('rara é até 10% das contas', () => {
    expect(isRareAchievement({ holders: 10, population: 100 })).toBe(true)
    expect(isRareAchievement({ holders: 11, population: 100 })).toBe(false)
  })

  it('base pequena demais não classifica nada como rara', () => {
    expect(isRareAchievement({ holders: 1, population: RARE_MIN_POPULATION - 1 })).toBe(false)
    expect(isRareAchievement({ holders: 1, population: RARE_MIN_POPULATION })).toBe(true)
  })

  it('ninguém com a conquista não é rara, é inexistente', () => {
    expect(isRareAchievement({ holders: 0, population: 500 })).toBe(false)
  })
})
