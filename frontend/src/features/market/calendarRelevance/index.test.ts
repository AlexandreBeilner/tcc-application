import { describe, expect, it } from 'vitest'
import { calendarDay } from '../../../test/calendarFixtures'
import { calendarRelevance } from '.'

const base = { date: '2026-07-08', weekday: 'wed', market_open: true }

describe('calendarRelevance', () => {
    it('separa Para você e No mercado, em ordem cronológica', () => {
        const days = [
            calendarDay({ ...base, simulated_day: 10 }, [
                { kind: 'copom', scope: 'global', future: true },
                {
                    kind: 'dividend_payment_date',
                    scope: 'global',
                    future: true,
                    ticker: 'BNDD3',
                    relevance: 'mine',
                    relevance_reason: 'position',
                },
            ]),
            calendarDay({ ...base, simulated_day: 11 }, []),
            calendarDay({ ...base, simulated_day: 12 }, [{ kind: 'order_executed', scope: 'user', future: false, ticker: 'BNDD3' }]),
        ]

        const result = calendarRelevance([days[2], days[0], days[1]])

        expect(result.mine.map((entry) => [entry.day.simulated_day, entry.event.kind])).toEqual([
            [10, 'dividend_payment_date'],
            [12, 'order_executed'],
        ])
        expect(result.market.map((entry) => entry.event.kind)).toEqual(['copom'])
        expect(result.summary).toMatchObject({ mineCount: 2, marketCount: 1 })
    })

    it('os contadores usam o summary do motor, que conta antes do corte', () => {
        const day = calendarDay({ ...base, simulated_day: 10 }, [{ kind: 'copom', scope: 'global', future: true }])
        day.summary = { mine_count: 0, market_count: 7 }

        expect(calendarRelevance([day]).summary.marketCount).toBe(7)
        expect(calendarRelevance([day]).market).toHaveLength(1)
    })

    it('soma só o pagamento futuro de provento do usuário (a data-ex não conta em dobro) e sinaliza estimativa', () => {
        const day = calendarDay({ ...base, simulated_day: 10 }, [
            {
                kind: 'dividend_payment_date',
                scope: 'global',
                future: true,
                relevance: 'mine',
                estimated_amount: 12.5,
                amount_is_estimate: false,
            },
            {
                kind: 'dividend_payment_date',
                scope: 'global',
                future: true,
                relevance: 'mine',
                estimated_amount: 7.5,
                amount_is_estimate: true,
            },
            {
                kind: 'dividend_ex_date',
                scope: 'global',
                future: true,
                relevance: 'mine',
                estimated_amount: 12.5,
                amount_is_estimate: false,
            },
            {
                kind: 'dividend_received',
                scope: 'user',
                future: false,
                relevance: 'mine',
                estimated_amount: 100,
                amount_is_estimate: false,
            },
        ])

        expect(calendarRelevance([day]).summary).toMatchObject({ upcomingPayout: 20, upcomingPayoutIsEstimate: true })
    })

    it('sem fatos devolve tudo vazio', () => {
        expect(calendarRelevance([])).toEqual({
            mine: [],
            market: [],
            summary: { mineCount: 0, marketCount: 0, upcomingPayout: 0, upcomingPayoutIsEstimate: false },
        })
    })
})
