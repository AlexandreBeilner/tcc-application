import { describe, expect, it } from 'vitest'
import type { CalendarEvent } from '../../../services/market'
import { describeCalendarEvent } from '.'

function event(overrides: Partial<CalendarEvent>): CalendarEvent {
    return { kind: 'macro_event', scope: 'global', future: false, relevance: 'market', ...overrides }
}

describe('describeCalendarEvent', () => {
    it('evento macro mostra só o título, sem a direção', () => {
        const view = describeCalendarEvent(event({ title: 'Novo pacote fiscal', direction: 'negativo' }))
        expect(view.title).toBe('Novo pacote fiscal')
        expect(JSON.stringify(view)).not.toContain('negativo')
    })

    it.each([
        [10.5, 10.5, 'Copom manteve a Selic em 10,50%'],
        [10.75, 10.5, 'Copom cortou a Selic para 10,50%'],
        [10.5, 10.75, 'Copom subiu a Selic para 10,75%'],
    ])('Copom realizado (anterior %s, nova %s)', (previous, current, title) => {
        const view = describeCalendarEvent(event({ kind: 'copom', selic_rate: current, previous_selic_rate: previous }))
        expect(view.title).toBe(title)
        expect(view.subtitle).toContain('Anterior')
    })

    it('Copom futuro não revela resultado', () => {
        const view = describeCalendarEvent(event({ kind: 'copom', future: true }))
        expect(view).toMatchObject({ title: 'Reunião do Copom', subtitle: 'Decisão da Selic' })
    })

    it('ordem do usuário vem marcada como sua', () => {
        const view = describeCalendarEvent(
            event({ kind: 'order_executed', scope: 'user', side: 'buy', ticker: 'BNDD3', quantity: 10, unit_value: 24.8 }),
        )
        expect(view.mine).toBe(true)
        expect(view.title).toBe('Compra de 10 BNDD3')
        expect(view.subtitle).toMatch(/^Executada a R\$\s24,80$/)
    })

    it('venda e provento', () => {
        expect(describeCalendarEvent(event({ kind: 'order_executed', side: 'sell', ticker: 'X1', quantity: 2 })).title).toBe(
            'Venda de 2 X1',
        )
        const ex = describeCalendarEvent(event({ kind: 'dividend_ex_date', ticker: 'PAPL11', unit_value: 0.88 }))
        expect(ex.title).toBe('PAPL11: data-ex')
        expect(ex.label).toBe('Provento')
    })

    it('relatório e vencimento', () => {
        expect(describeCalendarEvent(event({ kind: 'report' })).label).toBe('Balanço')
        expect(describeCalendarEvent(event({ kind: 'fixed_income_maturity', scope: 'user', ticker: 'LFT2029' })).title).toBe(
            'Vencimento de LFT2029',
        )
    })

    it('salário pago mostra o valor recebido', () => {
        const view = describeCalendarEvent(event({ kind: 'salary_payment', scope: 'user', unit_value: 1000 }))
        expect(view.title).toMatch(/^Salário: R\$\s1\.000,00$/)
        expect(view.label).toBe('Salário')
        expect(view.mine).toBe(true)
        expect(view.subtitle).toBe('Caiu na sua conta')
    })

    // Achado 025: catch-up de vários meses atrasados (backend, T.5) credita
    // mais de um salário no mesmo dia simulado, todos com o mesmo valor — sem
    // o mês no subtítulo, ficariam indistinguíveis na linha do tempo.
    it('salário pago com reference_month mostra a que mês se refere', () => {
        const view = describeCalendarEvent(event({ kind: 'salary_payment', scope: 'user', unit_value: 100, reference_month: '2026-06' }))
        expect(view.subtitle).toBe('Referente a junho de 2026')
    })

    it('catch-up de vários meses gera subtítulos distintos pro mesmo valor e dia', () => {
        const june = describeCalendarEvent(event({ kind: 'salary_payment', scope: 'user', unit_value: 100, reference_month: '2026-06' }))
        const july = describeCalendarEvent(event({ kind: 'salary_payment', scope: 'user', unit_value: 100, reference_month: '2026-07' }))
        expect(june.title).toBe(july.title)
        expect(june.subtitle).not.toBe(july.subtitle)
    })

    it('salário futuro anuncia o dia sem valor', () => {
        const view = describeCalendarEvent(event({ kind: 'salary_payment', scope: 'user', future: true }))
        expect(view.title).toBe('Dia de pagamento')
        expect(JSON.stringify(view)).not.toMatch(/R\$/)
    })
})

describe('describeCalendarEvent: valor do usuário', () => {
    it('provento com valor confirmado e com estimativa', () => {
        const exact = describeCalendarEvent(
            event({
                kind: 'dividend_payment_date',
                ticker: 'PAPL11',
                relevance: 'mine',
                user_quantity: 10,
                estimated_amount: 8.8,
                amount_is_estimate: false,
            }),
        )
        expect(exact.amount?.replace(/\u00a0/g, ' ')).toBe('10 unidades · R$ 8,80 (valor confirmado)')
        expect(exact.confirmed).toBe(true)

        const estimate = describeCalendarEvent(
            event({
                kind: 'dividend_payment_date',
                ticker: 'PAPL11',
                relevance: 'mine',
                user_quantity: 1,
                estimated_amount: 0.88,
                amount_is_estimate: true,
            }),
        )
        expect(estimate.amount?.replace(/\u00a0/g, ' ')).toBe('1 unidade · R$ 0,88 (estimado)')
        expect(estimate.confirmed).toBe(false)
    })

    it('sem valor do usuário não há linha de valor', () => {
        expect(describeCalendarEvent(event({ kind: 'copom' })).amount).toBeUndefined()
    })
})
