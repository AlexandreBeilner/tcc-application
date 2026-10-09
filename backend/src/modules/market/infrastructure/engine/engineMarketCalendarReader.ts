import type {
  MarketCalendar,
  MarketCalendarReader,
  MarketClock,
  TradingHaltStatus,
} from '../../application/ports/marketCalendarReader'
import { engineFetch } from './engineHttp'

export function createEngineMarketCalendarReader(engineUrl: string): MarketCalendarReader {
  return {
    getClock() {
      return engineFetch<MarketClock>(`${engineUrl}/market/clock`)
    },

    getCalendar(userId, query) {
      const params = new URLSearchParams({ user_id: userId })
      if (query.from !== undefined) params.set('from', query.from)
      if (query.to !== undefined) params.set('to', query.to)
      if (query.scope !== undefined) params.set('scope', query.scope)
      if (query.market_limit !== undefined) params.set('market_limit', String(query.market_limit))
      return engineFetch<MarketCalendar>(`${engineUrl}/market/calendar?${params.toString()}`)
    },

    getTradingHalts() {
      return engineFetch<TradingHaltStatus>(`${engineUrl}/market/halts`)
    },
  }
}
