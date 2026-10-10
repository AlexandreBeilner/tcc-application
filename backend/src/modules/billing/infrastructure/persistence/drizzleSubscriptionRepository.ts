import { eq } from 'drizzle-orm'
import type { Database } from '../../../../db/client'
import { subscriptions } from '../../../../db/schema'
import type { SubscriptionRepository } from '../../application/ports/subscriptionRepository'
import type { Subscription, SubscriptionPeriod, SubscriptionStore } from '../../domain/subscription'

type Row = typeof subscriptions.$inferSelect

function toSubscription(row: Row): Subscription {
  return {
    userId: row.userId,
    store: row.store as SubscriptionStore,
    productId: row.productId,
    period: row.period as SubscriptionPeriod,
    purchasedAt: row.purchasedAt,
    expiresAt: row.expiresAt,
    graceExpiresAt: row.graceExpiresAt,
    billingIssueDetectedAt: row.billingIssueDetectedAt,
    unsubscribeDetectedAt: row.unsubscribeDetectedAt,
    refundedAt: row.refundedAt,
    isSandbox: row.isSandbox,
    managementUrl: row.managementUrl,
    lastEventAt: row.lastEventAt,
    updatedAt: row.updatedAt,
  }
}

export function createDrizzleSubscriptionRepository(db: Database): SubscriptionRepository {
  return {
    async find(userId) {
      const [row] = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.userId, userId))
        .limit(1)
      return row ? toSubscription(row) : null
    },

    async upsert(subscription) {
      const { userId, ...values } = subscription
      await db
        .insert(subscriptions)
        .values({ userId, ...values })
        .onConflictDoUpdate({ target: subscriptions.userId, set: values })
    },
  }
}
