import { eq } from 'drizzle-orm'
import type { Database } from '../../../../db/client'
import { billingWebhookEvents } from '../../../../db/schema'
import type { BillingWebhookEventLog } from '../../application/ports/billingWebhookEventLog'

export function createDrizzleBillingWebhookEventLog(db: Database): BillingWebhookEventLog {
  return {
    async wasProcessed(eventId) {
      const [row] = await db
        .select({ id: billingWebhookEvents.id })
        .from(billingWebhookEvents)
        .where(eq(billingWebhookEvents.id, eventId))
        .limit(1)
      return row !== undefined
    },

    async record(eventId, eventType, at) {
      await db
        .insert(billingWebhookEvents)
        .values({ id: eventId, eventType, processedAt: at })
        .onConflictDoNothing()
    },
  }
}
