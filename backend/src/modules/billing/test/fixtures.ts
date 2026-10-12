import type { EntitlementState } from '../domain/subscription'

export const NOW = new Date('2026-10-10T12:00:00Z')
export const day = (n: number) => new Date(NOW.getTime() + n * 86_400_000)

export function entitlement(overrides: Partial<EntitlementState> = {}): EntitlementState {
  return {
    productId: 'pro_monthly',
    store: 'stripe',
    purchasedAt: day(-10),
    expiresAt: day(20),
    graceExpiresAt: null,
    billingIssueDetectedAt: null,
    unsubscribeDetectedAt: null,
    refundedAt: null,
    isSandbox: false,
    managementUrl: null,
    ...overrides,
  }
}
