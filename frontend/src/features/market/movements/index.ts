import type { MarketEvent } from '../../../services/market'
import { cashDirection, eventTotalValue } from '../cashFlow'

export type MovementKind = 'buy' | 'sell' | 'fixedIncomeIn' | 'fixedIncomeOut' | 'dividend' | 'salary' | 'credit' | 'deposit'

export interface Movement {
    id: string
    kind: MovementKind
    label: string
    quantity?: number
    unitPrice?: number
    /** Valor com sinal: positivo entrou, negativo saiu. */
    amount: number
    timestamp: string
}

const KIND_BY_TYPE: Record<string, MovementKind> = {
    buy_order_executed: 'buy',
    sell_order_executed: 'sell',
    fixed_income_purchase: 'fixedIncomeIn',
    fixed_income_redemption: 'fixedIncomeOut',
    dividend_payment: 'dividend',
    salary_payment: 'salary',
    admin_credit: 'credit',
    initial_deposit: 'deposit',
}

const LABEL_PREFIX: Partial<Record<MovementKind, string>> = {
    buy: 'Compra de',
    sell: 'Venda de',
    fixedIncomeIn: 'Aporte em',
    fixedIncomeOut: 'Resgate de',
    dividend: 'Provento de',
}

const FIXED_LABEL: Partial<Record<MovementKind, string>> = {
    salary: 'Salário',
    credit: 'Crédito do administrador',
    deposit: 'Depósito inicial',
}

// Ticker do ativo a partir do rótulo "TICKER · Nome" (`useAssetLabels`); sem catálogo, nunca o id cru.
function tickerOf(assetLabel: string | undefined): string {
    return assetLabel ? assetLabel.split(' · ')[0] : 'ativo'
}

export interface MovementContext {
    assetLabels: Record<string, string>
    /** Ids dos ativos do Modo Aprendizado: o feed é só do Mercado Ao Vivo (RF12/RNF08). */
    sandboxAssetIds: Set<string>
}

// "Últimas movimentações" do Portfólio (MO.9.3): as mais recentes do Mercado Ao Vivo, só o que o
// jogador enxerga como dinheiro entrando ou saindo. Eventos técnicos (bot, assembleia, fundos) e
// movimentos do sandbox ficam fora. A entrada já vem do motor com a mais recente primeiro.
export function buildMovements(events: MarketEvent[], context: MovementContext, limit = 10): Movement[] {
    const result: Movement[] = []
    for (const event of events) {
        const direction = cashDirection(event.event_type)
        const kind = KIND_BY_TYPE[event.event_type]
        const total = eventTotalValue(event)
        if (!direction || !kind || total === undefined) continue
        if (event.asset_id !== undefined && context.sandboxAssetIds.has(event.asset_id)) continue

        const prefix = LABEL_PREFIX[kind]
        const label = prefix
            ? `${prefix} ${tickerOf(event.asset_id ? context.assetLabels[event.asset_id] : undefined)}`
            : (FIXED_LABEL[kind] as string)
        result.push({
            id: event.id,
            kind,
            label,
            quantity: event.quantity,
            unitPrice: event.quantity !== undefined ? event.unit_value : undefined,
            amount: direction === 'in' ? total : -total,
            timestamp: event.timestamp,
        })
        if (result.length >= limit) break
    }
    return result
}

const MONTH_FORMATTER = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short' })

function startOfDay(date: Date): number {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

// "hoje", "ontem" ou "12 de out." (dia do calendário local, não 24 h corridas).
export function formatRelativeDay(timestamp: string, now: Date): string {
    const date = new Date(timestamp)
    const days = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000)
    if (days <= 0) return 'hoje'
    if (days === 1) return 'ontem'
    return MONTH_FORMATTER.format(date)
}
