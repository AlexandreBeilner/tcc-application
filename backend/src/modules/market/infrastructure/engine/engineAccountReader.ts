import type {
  AccountBalance,
  AccountEventRecord,
  AccountReader,
  FixedIncomePositionRecord,
  PositionRecord,
} from '../../application/ports/accountReader'
import { engineFetch } from './engineHttp'

export function createEngineAccountReader(engineUrl: string): AccountReader {
  return {
    getAccount(userId) {
      return engineFetch<AccountBalance>(`${engineUrl}/accounts/${userId}`)
    },

    listPositions(userId) {
      return engineFetch<PositionRecord[]>(
        `${engineUrl}/positions?user_id=${encodeURIComponent(userId)}`,
      )
    },

    listFixedIncomePositions(userId) {
      return engineFetch<FixedIncomePositionRecord[]>(
        `${engineUrl}/fixed-income/positions?user_id=${encodeURIComponent(userId)}`,
      )
    },

    listAccountEvents(userId, query) {
      const params = new URLSearchParams()
      if (query.limit !== undefined) params.set('limit', String(query.limit))
      if (query.offset !== undefined) params.set('offset', String(query.offset))
      const qs = params.toString()

      return engineFetch<AccountEventRecord[]>(
        `${engineUrl}/accounts/${userId}/events${qs ? `?${qs}` : ''}`,
      )
    },
  }
}
