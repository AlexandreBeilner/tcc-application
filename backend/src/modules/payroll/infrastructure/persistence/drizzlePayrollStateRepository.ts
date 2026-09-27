import { eq } from 'drizzle-orm'
import type { Database } from '../../../../db/client'
import { payrollState } from '../../../../db/schema'
import type { PayrollStateRepository } from '../../application/ports/payrollStateRepository'

export function createDrizzlePayrollStateRepository(db: Database): PayrollStateRepository {
  return {
    async getLastPaidMonth(userId) {
      const [row] = await db
        .select({ lastPaidMonth: payrollState.lastPaidMonth })
        .from(payrollState)
        .where(eq(payrollState.userId, userId))
        .limit(1)
      return row?.lastPaidMonth ?? null
    },

    async setLastPaidMonth(userId, monthKey) {
      await db
        .insert(payrollState)
        .values({ userId, lastPaidMonth: monthKey })
        .onConflictDoUpdate({
          target: payrollState.userId,
          set: { lastPaidMonth: monthKey, updatedAt: new Date() },
        })
    },
  }
}
