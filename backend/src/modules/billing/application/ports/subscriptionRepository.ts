import type { Subscription } from '../../domain/subscription'

export interface SubscriptionRepository {
  find(userId: string): Promise<Subscription | null>
  // Leitura em lote (uma query) pra telas que mostram vários usuários de uma vez.
  findMany(userIds: string[]): Promise<Subscription[]>
  // Uma linha por usuário: grava ou substitui.
  upsert(subscription: Subscription): Promise<void>
}
