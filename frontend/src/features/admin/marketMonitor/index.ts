import { formatDecimal, formatPriceToBook, formatSignedPercent } from '../../market/format'
import type { MonitorAsset, MonitorAssetType, MonitorIndicator } from '../../../services/admin'

// Filtro, ordenação e rótulos do monitor de mercado (N.8). Funções puras: a tabela só
// apresenta. Nada aqui recalcula número do motor, só escolhe o que mostrar e em que ordem.

export type MonitorSortKey = 'ticker' | 'last_price' | 'daily_change_pct' | 'spread_pct' | 'day_volume' | 'resting_orders'
export type MonitorSortDirection = 'asc' | 'desc'

export interface MonitorFilters {
    type: MonitorAssetType | 'all'
    sector: string | 'all'
    query: string
}

export const TYPE_LABELS: Record<MonitorAssetType, string> = {
    acao: 'Ação',
    etf: 'ETF',
    fii: 'FII',
}

export function monitorSectors(assets: MonitorAsset[]): string[] {
    return [...new Set(assets.map((a) => a.sector).filter((s): s is string => s !== null))].sort((a, b) => a.localeCompare(b, 'pt-BR'))
}

export function filterMonitorAssets(assets: MonitorAsset[], filters: MonitorFilters): MonitorAsset[] {
    const query = filters.query.trim().toLowerCase()
    return assets.filter(
        (a) =>
            (filters.type === 'all' || a.type === filters.type) &&
            (filters.sector === 'all' || a.sector === filters.sector) &&
            (query === '' || a.ticker.toLowerCase().includes(query) || a.name.toLowerCase().includes(query)),
    )
}

// Ativo sem valor na coluna (sem negócio, sem book) vai sempre pro fim, em qualquer direção:
// misturá-lo no meio faria "maior variação" listar ativos que nem negociaram.
export function sortMonitorAssets(assets: MonitorAsset[], key: MonitorSortKey, direction: MonitorSortDirection): MonitorAsset[] {
    const factor = direction === 'asc' ? 1 : -1
    return [...assets].sort((a, b) => {
        if (key === 'ticker') return a.ticker.localeCompare(b.ticker) * factor
        const left = a[key]
        const right = b[key]
        if (left === null && right === null) return a.ticker.localeCompare(b.ticker)
        if (left === null) return 1
        if (right === null) return -1
        return (left - right) * factor || a.ticker.localeCompare(b.ticker)
    })
}

const INDICATOR_LABELS: Record<MonitorIndicator['kind'], string> = {
    price_to_earnings: 'P/L',
    nav_premium_pct: 'Ágio/deságio',
    price_to_book: 'P/VP',
}

export function indicatorLabel(indicator: MonitorIndicator): string {
    return INDICATOR_LABELS[indicator.kind]
}

export function formatIndicatorValue(indicator: MonitorIndicator): string {
    if (indicator.kind === 'nav_premium_pct') return formatSignedPercent(indicator.value)
    if (indicator.kind === 'price_to_book') return formatPriceToBook(indicator.value)
    return formatDecimal(indicator.value)
}
