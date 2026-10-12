import { describe, expect, it } from 'vitest'
import { digestWeekKey, isWeeklyDigestDue } from './weeklyDigest'

// 2026-10-12 é segunda-feira. Brasília = UTC-3.
describe('isWeeklyDigestDue', () => {
  it('abre às 9h de Brasília na segunda e fecha às 21h', () => {
    expect(isWeeklyDigestDue(new Date('2026-10-12T11:59:00Z'))).toBe(false) // 8h59
    expect(isWeeklyDigestDue(new Date('2026-10-12T12:00:00Z'))).toBe(true) // 9h
    expect(isWeeklyDigestDue(new Date('2026-10-12T23:59:00Z'))).toBe(true) // 20h59
    expect(isWeeklyDigestDue(new Date('2026-10-13T00:00:00Z'))).toBe(false) // 21h
  })

  it('segue o dia de Brasília, não o de UTC', () => {
    // Segunda 01h UTC ainda é domingo à noite em Brasília.
    expect(isWeeklyDigestDue(new Date('2026-10-12T01:00:00Z'))).toBe(false)
  })

  it('não vale em outros dias da semana', () => {
    expect(isWeeklyDigestDue(new Date('2026-10-13T15:00:00Z'))).toBe(false) // terça
    expect(isWeeklyDigestDue(new Date('2026-10-18T15:00:00Z'))).toBe(false) // domingo
  })
})

describe('digestWeekKey', () => {
  it('é a segunda-feira de Brasília da semana', () => {
    expect(digestWeekKey(new Date('2026-10-12T15:00:00Z'))).toBe('2026-10-12')
    expect(digestWeekKey(new Date('2026-10-16T15:00:00Z'))).toBe('2026-10-12')
    expect(digestWeekKey(new Date('2026-10-18T20:00:00Z'))).toBe('2026-10-12')
    // Domingo à noite em Brasília, já segunda em UTC: ainda é a semana anterior.
    expect(digestWeekKey(new Date('2026-10-12T01:00:00Z'))).toBe('2026-10-05')
  })
})
