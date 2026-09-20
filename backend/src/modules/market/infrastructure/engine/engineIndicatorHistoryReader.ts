import type {
  IndicatorHistoryEntry,
  IndicatorHistoryReader,
} from '../../application/ports/indicatorHistoryReader'
import { engineFetch } from './engineHttp'

export function createEngineIndicatorHistoryReader(engineUrl: string): IndicatorHistoryReader {
  return {
    getIndicatorHistory(days) {
      const qs = days !== undefined ? `?days=${days}` : ''
      return engineFetch<IndicatorHistoryEntry[]>(`${engineUrl}/market/indicators/history${qs}`)
    },
  }
}
