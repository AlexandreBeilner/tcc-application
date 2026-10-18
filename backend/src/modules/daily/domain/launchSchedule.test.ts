import { describe, expect, it } from 'vitest'
import { MIN_CONTENT_DAYS_AHEAD, validateStartDateChange } from './launchSchedule'

const today = '2026-11-01'

describe('validateStartDateChange', () => {
  it.each([
    ['primeiro agendamento com 30 dias de conteúdo', null, '2026-11-10', 30, null],
    ['mudar enquanto futura, para outra data futura', '2026-11-10', '2026-11-20', 45, null],
    ['desligar enquanto ainda agendado', '2026-11-10', null, 0, null],
    ['29 dias de conteúdo não bastam', null, '2026-11-10', 29, 'insufficient_content'],
    ['sem conteúdo', null, '2026-11-10', 0, 'insufficient_content'],
    ['data de hoje não é agendar', null, '2026-11-01', 99, 'not_in_future'],
    ['data passada', null, '2026-10-20', 99, 'not_in_future'],
    ['depois do início: trava', '2026-11-01', '2026-11-20', 99, 'already_started'],
    ['muito depois do início: trava', '2026-10-01', '2026-11-20', 99, 'already_started'],
    ['no ar não pode ser desligado', '2026-10-01', null, 0, 'already_started'],
  ])('%s', (_label, current, next, reviewedDaysFromNext, expected) => {
    expect(validateStartDateChange({ current, next, today, reviewedDaysFromNext })).toBe(expected)
  })

  it('o mínimo é 30 dias (DI11)', () => {
    expect(MIN_CONTENT_DAYS_AHEAD).toBe(30)
  })
})
