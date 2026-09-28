import { describe, expect, it } from 'vitest'
import type { CalendarDay, CalendarEvent } from '../../../services/market'
import { nextSalaryPaymentDays } from '.'

function day(simulatedDay: number, events: CalendarEvent[]): CalendarDay {
    return { simulated_day: simulatedDay, date: '2026-01-01', weekday: 'mon', market_open: true, events }
}

function salaryEvent(future: boolean): CalendarEvent {
    return { kind: 'salary_payment', scope: 'user', future }
}

describe('nextSalaryPaymentDays (tarefa T.9)', () => {
    it('acha o próximo pagamento futuro e devolve a distância em dias simulados', () => {
        const days = [day(10, []), day(11, [salaryEvent(true)]), day(12, [])]

        expect(nextSalaryPaymentDays(days, 10)).toBe(1)
    })

    it('quando o pagamento é hoje, devolve 0', () => {
        const days = [day(10, [salaryEvent(true)])]

        expect(nextSalaryPaymentDays(days, 10)).toBe(0)
    })

    it('ignora dias antes de hoje', () => {
        const days = [day(9, [salaryEvent(true)]), day(15, [salaryEvent(true)])]

        expect(nextSalaryPaymentDays(days, 10)).toBe(5)
    })

    it('ignora evento de salário já pago (future: false)', () => {
        const days = [day(10, [salaryEvent(false)]), day(20, [salaryEvent(true)])]

        expect(nextSalaryPaymentDays(days, 10)).toBe(10)
    })

    it('sem evento de salário na janela, devolve null', () => {
        const days = [day(10, []), day(11, [])]

        expect(nextSalaryPaymentDays(days, 10)).toBeNull()
    })
})
