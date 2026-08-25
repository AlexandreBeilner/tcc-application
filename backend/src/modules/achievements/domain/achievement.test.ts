import { describe, expect, it } from 'vitest'
import {
  buildAchievementView,
  isSatisfied,
  progressValueFor,
  type ProgressSnapshot,
} from './achievement'

const snapshot: ProgressSnapshot = {
  netWorth: 12500,
  streakDays: 5,
  lessonsCompleted: 8,
  tradesExecuted: 3,
}

describe('progressValueFor', () => {
  it.each([
    ['net_worth', 12500],
    ['streak_days', 5],
    ['lessons_completed', 8],
    ['trades_executed', 3],
  ] as const)('lê o número certo do snapshot pra %s', (criteriaType, expected) => {
    expect(progressValueFor(criteriaType, snapshot)).toBe(expected)
  })
})

describe('isSatisfied', () => {
  it.each([
    ['net_worth', 12000, true],
    ['net_worth', 12500, true],
    ['net_worth', 13000, false],
    ['streak_days', 7, false],
    ['streak_days', 5, true],
    ['lessons_completed', 10, false],
    ['lessons_completed', 8, true],
    ['trades_executed', 1, true],
    ['trades_executed', 20, false],
  ] as const)('%s >= %d ? %s', (criteriaType, criteriaValue, expected) => {
    expect(isSatisfied(criteriaType, criteriaValue, snapshot)).toBe(expected)
  })
})

describe('buildAchievementView', () => {
  const achievement = {
    id: 'a1',
    name: 'Primeira Semana',
    description: null,
    criteriaType: 'streak_days' as const,
    criteriaValue: 7,
  }

  it('marca como bloqueada com progresso atual quando não desbloqueada', () => {
    const view = buildAchievementView(achievement, null, snapshot)

    expect(view.unlocked).toBe(false)
    expect(view.unlockedAt).toBeNull()
    expect(view.progress).toBe(5)
  })

  it('marca como desbloqueada quando já tem unlockedAt', () => {
    const unlockedAt = new Date('2026-08-20T00:00:00Z')

    const view = buildAchievementView(achievement, unlockedAt, snapshot)

    expect(view.unlocked).toBe(true)
    expect(view.unlockedAt).toBe(unlockedAt)
  })
})
