import type { QuoteHistoryEntry } from '../../../services/market'

export interface PriceChartRange {
    days: number
    label: string
}

export interface PriceChartProps {
    quotes: QuoteHistoryEntry[]
    ranges: PriceChartRange[]
    activeDays: number
    onRangeChange: (days: number) => void
}
