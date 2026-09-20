import type { IndicatorHistoryEntry } from '../../../services/market'

export interface IndicatorSummaryCardsProps {
    latest: IndicatorHistoryEntry | undefined
    nextCopomSimulatedDay: number
}
