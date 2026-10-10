import type { BillingMailer } from '../../application/ports/billingMailer'
import type { ProLifecycleEmail } from '../../domain/lifecycleEmails'
import type { BillingUserLookup } from '../../application/ports/billingUserLookup'
import type { BillingWebhookEventLog } from '../../application/ports/billingWebhookEventLog'
import type { EntitlementProvider } from '../../application/ports/entitlementProvider'
import type {
  CachedSubscription,
  SubscriptionCache,
} from '../../application/ports/subscriptionCache'
import type { SubscriptionRepository } from '../../application/ports/subscriptionRepository'
import type { EntitlementState, Subscription } from '../../domain/subscription'

export interface FakeSubscriptionRepository extends SubscriptionRepository {
  rows: Map<string, Subscription>
}

export function createFakeSubscriptionRepository(
  initial: Subscription[] = [],
): FakeSubscriptionRepository {
  const rows = new Map(initial.map((s) => [s.userId, s]))
  return {
    rows,
    async find(userId) {
      return rows.get(userId) ?? null
    },
    async upsert(subscription) {
      rows.set(subscription.userId, subscription)
    },
  }
}

export interface FakeEntitlementProvider extends EntitlementProvider {
  states: Map<string, EntitlementState | null>
  calls: string[]
  failWith?: Error
}

export function createFakeEntitlementProvider(
  initial: Record<string, EntitlementState | null> = {},
): FakeEntitlementProvider {
  const fake: FakeEntitlementProvider = {
    states: new Map(Object.entries(initial)),
    calls: [],
    async getEntitlement(userId) {
      fake.calls.push(userId)
      if (fake.failWith) throw fake.failWith
      return fake.states.get(userId) ?? null
    },
  }
  return fake
}

export interface FakeSubscriptionCache extends SubscriptionCache {
  entries: Map<string, CachedSubscription>
  gets: number
  invalidated: string[]
}

export function createFakeSubscriptionCache(): FakeSubscriptionCache {
  const fake: FakeSubscriptionCache = {
    entries: new Map(),
    gets: 0,
    invalidated: [],
    async get(userId) {
      fake.gets += 1
      return fake.entries.get(userId) ?? null
    },
    async set(userId, value) {
      fake.entries.set(userId, value)
    },
    async invalidate(userId) {
      fake.invalidated.push(userId)
      fake.entries.delete(userId)
    },
  }
  return fake
}

export function createFakeBillingWebhookEventLog(): BillingWebhookEventLog & {
  recorded: Map<string, string>
} {
  const recorded = new Map<string, string>()
  return {
    recorded,
    async wasProcessed(eventId) {
      return recorded.has(eventId)
    },
    async record(eventId, eventType) {
      recorded.set(eventId, eventType)
    },
  }
}

export function createFakeBillingUserLookup(knownUserIds: string[]): BillingUserLookup {
  const known = new Set(knownUserIds)
  return {
    async existingUserIds(candidateIds) {
      return candidateIds.filter((id) => known.has(id))
    },
  }
}

export interface FakeBillingMailer extends BillingMailer {
  sent: Array<{ userId: string; email: ProLifecycleEmail }>
  failWith?: Error
}

export function createFakeBillingMailer(): FakeBillingMailer {
  const fake: FakeBillingMailer = {
    sent: [],
    async send(userId, email) {
      if (fake.failWith) throw fake.failWith
      fake.sent.push({ userId, email })
    },
  }
  return fake
}
