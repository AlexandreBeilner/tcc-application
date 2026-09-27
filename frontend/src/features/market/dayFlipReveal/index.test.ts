import { describe, expect, it } from 'vitest'
import type { MarketClock } from '../../../services/market'
import { describeDayFlip, describeSalaryReveal } from '.'

const open: MarketClock = {
    simulated_day: 135,
    date: '2026-07-08',
    weekday: 'wed',
    market_open: true,
    days_until_open: 0,
    days_per_real_day: 5,
    next_tick_at: null,
    quarter_day: 44,
    quarter_length: 91,
}

describe('describeDayFlip', () => {
    it('mercado aberto mostra a Selic vigente', () => {
        expect(describeDayFlip(open, 10.5)).toEqual({ title: 'Novo dia: Selic 10,50%', description: 'quarta 08/07: mercado aberto' })
    })

    it('sem Selic conhecida cai no número do dia', () => {
        expect(describeDayFlip(open, null).title).toBe('Novo dia: dia 135')
    })

    it('fim de semana convida a estudar', () => {
        const closed = { ...open, market_open: false, weekday: 'sat', days_until_open: 2 }
        expect(describeDayFlip(closed, 10.5)).toEqual({
            title: 'Novo dia: fim de semana',
            description: 'Mercado fechado até segunda. Hora de estudar.',
        })
    })
})

describe('describeSalaryReveal', () => {
    it('anuncia o valor recebido', () => {
        const content = describeSalaryReveal(1000)
        expect(content.title).toBe('Salário do mês')
        expect(content.description).toMatch(/^R\$\s1\.000,00 caiu na sua conta$/)
    })
})
