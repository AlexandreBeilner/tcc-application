import { describe, expect, it } from 'vitest'
import {
  businessDaysElapsed,
  isFifthBusinessDayOfMonth,
  type CalendarDaySummary,
} from './businessDay'

const WEEK_CYCLE = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

// Gera `count` dias consecutivos a partir do dia 1 do mês, começando na
// semana em `startWeekday` — só o `weekday` importa pro domínio, então a
// `date` é só um rótulo sequencial (dia 1, dia 2, ...).
function monthDays(startWeekday: string, count: number): CalendarDaySummary[] {
  const startIndex = WEEK_CYCLE.indexOf(startWeekday)
  return Array.from({ length: count }, (_, i) => ({
    date: `dia-${i + 1}`,
    weekday: WEEK_CYCLE[(startIndex + i) % 7],
  }))
}

describe('isFifthBusinessDayOfMonth', () => {
  it('mês começando numa segunda (sem fim de semana entre o 1º e o 5º dia útil) — 5º dia útil é dia 5', () => {
    const days = monthDays('mon', 5)
    expect(isFifthBusinessDayOfMonth(days)).toBe(true)
    expect(isFifthBusinessDayOfMonth(days.slice(0, 4))).toBe(false)
  })

  it('mês começando numa sexta — 5º dia útil é dia 7 (pula sáb/dom no meio)', () => {
    const days = monthDays('fri', 7)
    expect(isFifthBusinessDayOfMonth(days)).toBe(true)
    expect(isFifthBusinessDayOfMonth(days.slice(0, 6))).toBe(false)
  })

  it('mês começando num sábado — 5º dia útil é dia 7', () => {
    const days = monthDays('sat', 7)
    expect(isFifthBusinessDayOfMonth(days)).toBe(true)
    expect(isFifthBusinessDayOfMonth(days.slice(0, 6))).toBe(false)
  })

  it('mês começando num domingo — 5º dia útil é dia 6', () => {
    const days = monthDays('sun', 6)
    expect(isFifthBusinessDayOfMonth(days)).toBe(true)
    expect(isFifthBusinessDayOfMonth(days.slice(0, 5))).toBe(false)
  })

  it('nunca conta sábado/domingo como dia útil, mesmo se "hoje" cair num fim de semana', () => {
    const days = monthDays('mon', 6)
    expect(days[5].weekday).toBe('sat')
    expect(isFifthBusinessDayOfMonth(days)).toBe(false)
  })

  it('lista vazia não é o 5º dia útil', () => {
    expect(isFifthBusinessDayOfMonth([])).toBe(false)
  })
})

describe('businessDaysElapsed', () => {
  it('conta dias úteis mesmo além do 5º (mês corrente já venceu o pagamento)', () => {
    expect(businessDaysElapsed(monthDays('mon', 10))).toBe(8)
  })

  it('ignora sábado/domingo na contagem', () => {
    expect(businessDaysElapsed(monthDays('fri', 3))).toBe(1)
  })

  it('lista vazia dá zero', () => {
    expect(businessDaysElapsed([])).toBe(0)
  })
})
