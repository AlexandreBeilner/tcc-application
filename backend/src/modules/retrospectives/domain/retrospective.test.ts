import { describe, expect, it } from 'vitest'
import {
  availableMonths,
  isMonthKey,
  longestRun,
  monthKeyOf,
  monthRange,
  previousMonth,
  toView,
  type RetrospectiveData,
} from './retrospective'

describe('meses', () => {
  it.each([
    ['2026-10', true],
    ['2026-13', false],
    ['2026-00', false],
    ['26-10', false],
    ['2026-1', false],
  ])('isMonthKey(%s)', (value, expected) => {
    expect(isMonthKey(value)).toBe(expected)
  })

  it('mês anterior vira o ano', () => {
    expect(previousMonth(new Date('2026-10-10T12:00:00Z'))).toBe('2026-09')
    expect(previousMonth(new Date('2026-01-01T00:00:00Z'))).toBe('2025-12')
    expect(monthKeyOf(new Date('2026-03-31T23:59:59Z'))).toBe('2026-03')
  })

  it('intervalo do mês, com fevereiro bissexto e mês de 31 dias', () => {
    expect(monthRange('2028-02').daysInMonth).toBe(29)
    expect(monthRange('2026-02').daysInMonth).toBe(28)
    const oct = monthRange('2026-10')
    expect(oct.daysInMonth).toBe(31)
    expect(oct.start.toISOString()).toBe('2026-10-01T00:00:00.000Z')
    expect(oct.endExclusive.toISOString()).toBe('2026-11-01T00:00:00.000Z')
    expect([oct.firstDay, oct.lastDay]).toEqual(['2026-10-01', '2026-10-31'])
  })

  it('meses disponíveis: do mês da conta até o anterior ao atual, mais recentes primeiro', () => {
    const now = new Date('2026-10-10T00:00:00Z')
    expect(availableMonths(new Date('2026-07-20T00:00:00Z'), now)).toEqual([
      '2026-09',
      '2026-08',
      '2026-07',
    ])
    expect(availableMonths(new Date('2026-10-05T00:00:00Z'), now)).toEqual([])
    expect(availableMonths(new Date('2020-01-01T00:00:00Z'), now, 4)).toHaveLength(4)
    expect(
      availableMonths(new Date('2025-11-01T00:00:00Z'), new Date('2026-01-15T00:00:00Z')),
    ).toEqual(['2025-12', '2025-11'])
  })
})

describe('longestRun', () => {
  it.each([
    [[], 0],
    [[5], 1],
    [[1, 2, 3, 10, 11], 3],
    [[3, 1, 2, 2, 2], 3],
    [[1, 3, 5], 1],
    [[28, 29, 30, 31], 4],
  ])('%j -> %i', (days, expected) => {
    expect(longestRun(days)).toBe(expected)
  })
})

const data: RetrospectiveData = {
  month: '2026-09',
  lessonsCompleted: 6,
  achievementsUnlocked: 2,
  achievementNames: ['Primeira Semana', 'Estudioso'],
  level: 5,
  activeDays: [1, 2, 3, 9],
  daysInMonth: 30,
  longestStreak: 3,
  bestReturnPct: 4.2,
  duelsPlayed: 1,
  duelsWon: 1,
  leaguesActive: 2,
}

describe('toView', () => {
  it('PRO recebe o conteúdo completo', () => {
    const view = toView(data, true)
    expect(view.full).toBe(true)
    expect(view.premium).toMatchObject({ longestStreak: 3, bestReturnPct: 4.2, duelsWon: 1 })
  })

  it('quem não é PRO recebe só a versão simples: o conteúdo premium nem sai do servidor', () => {
    const view = toView(data, false)
    expect(view.full).toBe(false)
    expect(view.premium).toBeNull()
    expect(JSON.stringify(view)).not.toContain('4.2')
    expect(view).toMatchObject({ lessonsCompleted: 6, achievementsUnlocked: 2, level: 5 })
  })

  it('mês sem nada fica marcado como vazio', () => {
    const empty = toView(
      {
        ...data,
        lessonsCompleted: 0,
        achievementsUnlocked: 0,
        achievementNames: [],
        activeDays: [],
        duelsPlayed: 0,
      },
      true,
    )
    expect(empty.empty).toBe(true)
    expect(toView(data, true).empty).toBe(false)
  })
})
