import type { MarketEvent } from '../../../services/market'

export type CashDirection = 'in' | 'out'

// Dinheiro que entra na conta e dinheiro que sai (MO.9.4/MO.9.3). Tipo fora das duas listas
// (eventos técnicos de bot, assembleia, fundos) não tem direção: nunca vira linha de dinheiro.
const INFLOW = new Set([
    'initial_deposit',
    'sell_order_executed',
    'fixed_income_redemption',
    'dividend_payment',
    'salary_payment',
    'admin_credit',
])
const OUTFLOW = new Set(['buy_order_executed', 'fixed_income_purchase'])

export function cashDirection(eventType: string): CashDirection | null {
    if (INFLOW.has(eventType)) return 'in'
    if (OUTFLOW.has(eventType)) return 'out'
    return null
}

// `unit_value` é preço por unidade quando o evento traz `quantity` (compra, venda, provento); sem
// quantidade (depósito, salário, renda fixa, crédito) já é o total.
export function eventTotalValue(event: Pick<MarketEvent, 'unit_value' | 'quantity'>): number | undefined {
    if (event.unit_value === undefined) return undefined
    return event.quantity !== undefined ? event.unit_value * event.quantity : event.unit_value
}
