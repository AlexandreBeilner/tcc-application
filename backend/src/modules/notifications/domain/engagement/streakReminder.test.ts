import { describe, expect, it } from 'vitest'
import {
  isStreakReminderDue,
  lastActivityDayForReminder,
  streakReminderDay,
} from './streakReminder'

// Brasília = UTC-3: 17h = 20h UTC; 20h = 23h UTC.
describe('isStreakReminderDue', () => {
  it('só entre 17h e 19h59 de Brasília', () => {
    expect(isStreakReminderDue(new Date('2026-10-12T19:59:00Z'))).toBe(false) // 16h59
    expect(isStreakReminderDue(new Date('2026-10-12T20:00:00Z'))).toBe(true) // 17h
    expect(isStreakReminderDue(new Date('2026-10-12T22:59:00Z'))).toBe(true) // 19h59
    expect(isStreakReminderDue(new Date('2026-10-12T23:00:00Z'))).toBe(false) // 20h
    expect(isStreakReminderDue(new Date('2026-10-12T09:00:00Z'))).toBe(false) // 6h
  })
})

describe('dia do lembrete', () => {
  it('na janela, o dia de Brasília e o de UTC são o mesmo, e a referência é o dia anterior', () => {
    const now = new Date('2026-10-12T21:00:00Z')

    expect(streakReminderDay(now)).toBe('2026-10-12')
    expect(lastActivityDayForReminder(now)).toBe('2026-10-11')
    expect(lastActivityDayForReminder(new Date('2026-11-01T21:00:00Z'))).toBe('2026-10-31')
  })
})
