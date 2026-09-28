import { describe, expect, it } from 'vitest'
import { monthlySalaryForLevel } from './salary'

describe('monthlySalaryForLevel', () => {
  it.each([
    [1, 100],
    [10, 1000],
    [11, 1200],
    [20, 3000],
    [21, 3300],
    [30, 6000],
    [100, 55000],
  ])('nível %i → R$%i/mês', (level, expected) => {
    expect(monthlySalaryForLevel(level)).toBe(expected)
  })
})
