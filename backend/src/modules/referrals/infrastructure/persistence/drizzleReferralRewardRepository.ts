import { and, asc, eq } from 'drizzle-orm'
import type { Database } from '../../../../db/client'
import { referralMilestones, referralRewards } from '../../../../db/schema'
import type { ReferralRewardRepository } from '../../application/ports/referralRewardRepository'

export function createDrizzleReferralRewardRepository(db: Database): ReferralRewardRepository {
  return {
    async listMilestones() {
      return db
        .select({
          threshold: referralMilestones.threshold,
          rewardDays: referralMilestones.rewardDays,
        })
        .from(referralMilestones)
        .orderBy(asc(referralMilestones.threshold))
    },
    async ensureRewards(referrerId, milestones) {
      if (milestones.length === 0) return
      await db
        .insert(referralRewards)
        .values(
          milestones.map((m) => ({
            referrerId,
            threshold: m.threshold,
            rewardDays: m.rewardDays,
          })),
        )
        .onConflictDoNothing()
    },
    async listRewards(referrerId) {
      const rows = await db
        .select()
        .from(referralRewards)
        .where(eq(referralRewards.referrerId, referrerId))
        .orderBy(asc(referralRewards.threshold))
      return rows.map((r) => ({
        threshold: r.threshold,
        rewardDays: r.rewardDays,
        status: r.status as 'pending' | 'granted',
        promoEndsAt: r.promoEndsAt,
        grantedAt: r.grantedAt,
      }))
    },
    async setPromoEnd(referrerId, threshold, endsAt) {
      await db
        .update(referralRewards)
        .set({ promoEndsAt: endsAt })
        .where(
          and(eq(referralRewards.referrerId, referrerId), eq(referralRewards.threshold, threshold)),
        )
    },
    async markGranted(referrerId, threshold, at) {
      await db
        .update(referralRewards)
        .set({ status: 'granted', grantedAt: at })
        .where(
          and(eq(referralRewards.referrerId, referrerId), eq(referralRewards.threshold, threshold)),
        )
    },
  }
}
