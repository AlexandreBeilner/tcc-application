import type { Subscription } from '../../domain/subscription'

export interface SubscriptionRepository {
  find(userId: string): Promise<Subscription | null>
  // Uma linha por usuário: grava ou substitui.
  upsert(subscription: Subscription): Promise<void>
}
