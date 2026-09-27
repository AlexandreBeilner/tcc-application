import { describe, expect, it } from 'vitest'
import { createInProcessMonthlySalaryReader } from './inProcessMonthlySalaryReader'

describe('createInProcessMonthlySalaryReader', () => {
  it.each([
    [1, 100],
    [10, 1000],
    [20, 3000],
    [30, 6000],
  ])('nível %i → R$%i/mês, mesma fórmula de payroll (T.3)', (level, expected) => {
    const reader = createInProcessMonthlySalaryReader()
    expect(reader.getMonthlySalaryForLevel(level)).toBe(expected)
  })
})
