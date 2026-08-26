import type { ProfitabilityReader } from '../../application/ports/profitabilityReader'

export function createFakeProfitabilityReader(
  pctByUserId: Record<string, number> = {},
): ProfitabilityReader {
  return {
    async getProfitabilityPct(userId) {
      return pctByUserId[userId] ?? 0
    },
  }
}
