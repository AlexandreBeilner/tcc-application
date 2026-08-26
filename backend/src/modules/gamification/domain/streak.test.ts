import { describe, expect, it } from 'vitest'
import { todayUtc, touch } from './streak'

describe('touch', () => {
  it('primeira atividade histórica: streak vira 1, longest acompanha', () => {
    const result = touch(
      { currentStreak: 0, longestStreak: 0, lastQualifyingActivityDate: null },
      '2026-08-24',
    )

    expect(result).toEqual({
      currentStreak: 1,
      longestStreak: 1,
      lastQualifyingActivityDate: '2026-08-24',
    })
  })

  it('mesma data da última atividade: idempotente, não infla o contador', () => {
    const current = {
      currentStreak: 5,
      longestStreak: 10,
      lastQualifyingActivityDate: '2026-08-24',
    }

    const result = touch(current, '2026-08-24')

    expect(result).toEqual(current)
  })

  it('dia seguinte consecutivo: streak soma 1', () => {
    const current = {
      currentStreak: 5,
      longestStreak: 10,
      lastQualifyingActivityDate: '2026-08-24',
    }

    const result = touch(current, '2026-08-25')

    expect(result).toEqual({
      currentStreak: 6,
      longestStreak: 10,
      lastQualifyingActivityDate: '2026-08-25',
    })
  })

  it.each([
    ['gap de 2 dias', '2026-08-26'],
    ['gap de 7 dias', '2026-08-31'],
    ['gap de 30 dias', '2026-09-23'],
  ])('%s sem atividade qualificada reseta streak pra 1', (_label, today) => {
    const current = {
      currentStreak: 12,
      longestStreak: 12,
      lastQualifyingActivityDate: '2026-08-24',
    }

    const result = touch(current, today)

    expect(result.currentStreak).toBe(1)
    expect(result.lastQualifyingActivityDate).toBe(today)
  })

  it('longestStreak nunca decresce após um reset', () => {
    const current = {
      currentStreak: 20,
      longestStreak: 20,
      lastQualifyingActivityDate: '2026-08-24',
    }

    const result = touch(current, '2026-09-01')

    expect(result.currentStreak).toBe(1)
    expect(result.longestStreak).toBe(20)
  })

  it('longestStreak atualiza quando o streak atual supera o recorde anterior', () => {
    const current = {
      currentStreak: 3,
      longestStreak: 3,
      lastQualifyingActivityDate: '2026-08-24',
    }

    const result = touch(current, '2026-08-25')

    expect(result.longestStreak).toBe(4)
  })
})

describe('todayUtc', () => {
  it('formata a data em YYYY-MM-DD, UTC', () => {
    expect(todayUtc(new Date('2026-08-24T23:59:59Z'))).toBe('2026-08-24')
    expect(todayUtc(new Date('2026-08-25T00:00:00Z'))).toBe('2026-08-25')
  })
})
