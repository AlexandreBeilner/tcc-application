import { describe, expect, it } from 'vitest'
import { monthsToPay } from './payrollDecision'

describe('monthsToPay', () => {
  it('pago — mês corrente vencido (5 dias úteis) e nunca pago antes', () => {
    expect(
      monthsToPay({
        currentMonthKey: '2026-09',
        lastPaidMonthKey: null,
        currentMonthBusinessDaysElapsed: 5,
        maxCatchUpMonths: 3,
      }),
    ).toEqual(['2026-09'])
  })

  it('já pago — mês corrente já é o último pago, não paga de novo', () => {
    expect(
      monthsToPay({
        currentMonthKey: '2026-09',
        lastPaidMonthKey: '2026-09',
        currentMonthBusinessDaysElapsed: 20,
        maxCatchUpMonths: 3,
      }),
    ).toEqual([])
  })

  it('fora do dia — mês corrente ainda não venceu (menos de 5 dias úteis)', () => {
    expect(
      monthsToPay({
        currentMonthKey: '2026-09',
        lastPaidMonthKey: '2026-08',
        currentMonthBusinessDaysElapsed: 3,
        maxCatchUpMonths: 3,
      }),
    ).toEqual([])
  })

  it('fora do dia, nunca pago antes — mesmo resultado (sem catch-up retroativo)', () => {
    expect(
      monthsToPay({
        currentMonthKey: '2026-09',
        lastPaidMonthKey: null,
        currentMonthBusinessDaysElapsed: 2,
        maxCatchUpMonths: 3,
      }),
    ).toEqual([])
  })

  it('catch-up — perdeu o mês passado inteiro, paga os dois (dentro do teto)', () => {
    expect(
      monthsToPay({
        currentMonthKey: '2026-09',
        lastPaidMonthKey: '2026-07',
        currentMonthBusinessDaysElapsed: 5,
        maxCatchUpMonths: 3,
      }),
    ).toEqual(['2026-08', '2026-09'])
  })

  it('catch-up — meses em atraso além do teto descartam os mais antigos', () => {
    expect(
      monthsToPay({
        currentMonthKey: '2026-09',
        lastPaidMonthKey: '2026-04',
        currentMonthBusinessDaysElapsed: 5,
        maxCatchUpMonths: 2,
      }),
    ).toEqual(['2026-08', '2026-09'])
  })

  it('catch-up com meses passados vencidos mas mês corrente ainda não — paga só os passados', () => {
    expect(
      monthsToPay({
        currentMonthKey: '2026-09',
        lastPaidMonthKey: '2026-07',
        currentMonthBusinessDaysElapsed: 1,
        maxCatchUpMonths: 3,
      }),
    ).toEqual(['2026-08'])
  })

  it('virada de ano é aritmética correta (dezembro → janeiro)', () => {
    expect(
      monthsToPay({
        currentMonthKey: '2027-01',
        lastPaidMonthKey: '2026-11',
        currentMonthBusinessDaysElapsed: 5,
        maxCatchUpMonths: 3,
      }),
    ).toEqual(['2026-12', '2027-01'])
  })
})
