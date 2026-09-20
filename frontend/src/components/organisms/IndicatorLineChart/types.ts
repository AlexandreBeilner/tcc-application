import type { IndicatorChartEntry } from '../../../features/market/indicatorChartLayout'

export interface IndicatorLineChartRange {
    days: number
    label: string
}

export interface IndicatorLineChartProps {
    title: string
    entries: IndicatorChartEntry[]
    ranges: IndicatorLineChartRange[]
    activeDays: number
    onRangeChange: (days: number) => void
    formatValue: (value: number) => string
    emptyMessage?: string
}
