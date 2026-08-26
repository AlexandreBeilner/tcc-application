import { describe, expect, it } from 'vitest'
import { levelForXp } from './progression'

describe('levelForXp', () => {
  it.each([
    [0, 1],
    [50, 1],
    [99, 1],
    [100, 2],
    [299, 2],
    [300, 3],
    [599, 3],
    [600, 4],
    [999, 4],
    [1000, 5],
  ])('xp=%i → nível %i', (xp, expectedLevel) => {
    expect(levelForXp(xp)).toBe(expectedLevel)
  })

  it('sobe 2+ níveis de uma vez quando o xp salta um degrau grande', () => {
    expect(levelForXp(0)).toBe(1)
    expect(levelForXp(700)).toBe(4)
  })
})
