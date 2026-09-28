import type { PayrollStateRepository } from '../../application/ports/payrollStateRepository'

export function createFakePayrollStateRepository(
  lastPaidMonthByUserId: Record<string, string> = {},
): PayrollStateRepository {
  const state = { ...lastPaidMonthByUserId }
  return {
    async getLastPaidMonth(userId) {
      return state[userId] ?? null
    },
    async setLastPaidMonth(userId, monthKey) {
      state[userId] = monthKey
    },
  }
}
