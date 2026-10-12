import { describe, expect, it } from 'vitest'
import type { MarketEvent } from '../../../services/market'
import { buildMovements, formatRelativeDay } from '.'

const ctx = {
    assetLabels: { a1: 'VALE3 · Vale', a2: 'CDB2027 · CDB Banco', s1: 'TREINO3 · Treino' },
    sandboxAssetIds: new Set(['s1']),
}
function ev(id: string, event_type: string, extra: Partial<MarketEvent> = {}): MarketEvent {
    return { id, event_type, timestamp: '2026-10-11T12:00:00Z', ...extra }
}

describe('buildMovements', () => {
    it('rotula cada tipo, com sinal e valor total', () => {
        const rows = buildMovements(
            [
                ev('1', 'buy_order_executed', { asset_id: 'a1', quantity: 10, unit_value: 30 }),
                ev('2', 'sell_order_executed', { asset_id: 'a1', quantity: 5, unit_value: 40 }),
                ev('3', 'dividend_payment', { asset_id: 'a1', quantity: 5, unit_value: 1.2 }),
                ev('4', 'fixed_income_purchase', { asset_id: 'a2', unit_value: 1000 }),
                ev('5', 'fixed_income_redemption', { asset_id: 'a2', unit_value: 1050 }),
                ev('6', 'salary_payment', { unit_value: 200 }),
                ev('7', 'admin_credit', { unit_value: 500 }),
                ev('8', 'initial_deposit', { unit_value: 10000 }),
            ],
            ctx,
        )
        expect(rows.map((r) => [r.label, r.amount])).toEqual([
            ['Compra de VALE3', -300],
            ['Venda de VALE3', 200],
            ['Provento de VALE3', 6],
            ['Aporte em CDB2027', -1000],
            ['Resgate de CDB2027', 1050],
            ['Salário', 200],
            ['Crédito do administrador', 500],
            ['Depósito inicial', 10000],
        ])
        expect(rows[0]).toMatchObject({ quantity: 10, unitPrice: 30 })
        expect(rows[3].quantity).toBeUndefined()
    })

    it('deixa de fora eventos técnicos, o sandbox e evento sem valor', () => {
        const rows = buildMovements(
            [
                ev('1', 'bot_initial_cash', { unit_value: 5 }),
                ev('2', 'assembly_decision'),
                ev('3', 'etf_creation', { unit_value: 5 }),
                ev('4', 'buy_order_executed', { asset_id: 's1', quantity: 1, unit_value: 10 }),
                ev('5', 'salary_payment'),
                ev('6', 'salary_payment', { unit_value: 100 }),
            ],
            ctx,
        )
        expect(rows.map((r) => r.id)).toEqual(['6'])
    })

    it('rótulo vem do catálogo, nunca do id; sem catálogo cai em "ativo"', () => {
        const [row] = buildMovements([ev('1', 'buy_order_executed', { asset_id: 'zzz', quantity: 1, unit_value: 1 })], ctx)
        expect(row.label).toBe('Compra de ativo')
        expect(row.label).not.toContain('zzz')
    })

    it('respeita o limite, mantendo a ordem recebida', () => {
        const events = Array.from({ length: 15 }, (_, i) => ev(String(i), 'salary_payment', { unit_value: 1 }))
        const rows = buildMovements(events, ctx, 10)
        expect(rows).toHaveLength(10)
        expect(rows[0].id).toBe('0')
        expect(rows[9].id).toBe('9')
    })
})

describe('formatRelativeDay', () => {
    const now = new Date(2026, 9, 11, 15, 0)
    it('hoje, ontem e data', () => {
        expect(formatRelativeDay(new Date(2026, 9, 11, 1, 0).toISOString(), now)).toBe('hoje')
        expect(formatRelativeDay(new Date(2026, 9, 10, 23, 0).toISOString(), now)).toBe('ontem')
        expect(formatRelativeDay(new Date(2026, 8, 3, 12, 0).toISOString(), now)).toMatch(/^3 de set/)
    })
})
