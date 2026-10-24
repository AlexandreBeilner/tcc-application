import { and, count, eq } from 'drizzle-orm'
import type { Database } from '../../../../db/client'
import { referralCodes, referrals } from '../../../../db/schema'
import type { ReferralRepository } from '../../application/ports/referralRepository'

export function createDrizzleReferralRepository(db: Database): ReferralRepository {
  const countByStatus = async (referrerId: string, status: 'pending' | 'qualified') => {
    const [row] = await db
      .select({ total: count() })
      .from(referrals)
      .where(and(eq(referrals.referrerId, referrerId), eq(referrals.status, status)))
    return row?.total ?? 0
  }

  return {
    async findCodeByUser(userId) {
      const [row] = await db
        .select({ code: referralCodes.code })
        .from(referralCodes)
        .where(eq(referralCodes.userId, userId))
      return row?.code ?? null
    },
    async findUserByCode(code) {
      const [row] = await db
        .select({ userId: referralCodes.userId })
        .from(referralCodes)
        .where(eq(referralCodes.code, code))
      return row?.userId ?? null
    },
    async insertCode(userId, code) {
      const rows = await db
        .insert(referralCodes)
        .values({ userId, code })
        .onConflictDoNothing()
        .returning({ userId: referralCodes.userId })
      return rows.length > 0
    },
    async createReferral(referrerId, referredId) {
      if (referrerId === referredId) return false
      const rows = await db
        .insert(referrals)
        .values({ referrerId, referredId })
        .onConflictDoNothing({ target: referrals.referredId })
        .returning({ id: referrals.id })
      return rows.length > 0
    },
    async qualify(referredId, at) {
      // Condicional: só a primeira chamada vê o status 'pending', então valida uma única vez.
      const rows = await db
        .update(referrals)
        .set({ status: 'qualified', qualifiedAt: at })
        .where(and(eq(referrals.referredId, referredId), eq(referrals.status, 'pending')))
        .returning({ referrerId: referrals.referrerId })
      return rows[0]?.referrerId ?? null
    },
    countQualified: (referrerId) => countByStatus(referrerId, 'qualified'),
    countPending: (referrerId) => countByStatus(referrerId, 'pending'),
  }
}
