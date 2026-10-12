import type { Subscription } from '../../domain/subscription'

// Cache de poucos segundos da projeção local, pra não consultar o Postgres em toda requisição
// gateada. Guarda os FATOS (não o "é PRO?"): a decisão é recalculada com a hora de agora a cada
// leitura, então um vencimento no meio do TTL não vira PRO eterno.
export type CachedSubscription = { subscription: Subscription | null }

export interface SubscriptionCache {
  // `null` = não está em cache. `{ subscription: null }` = está em cache que a pessoa é free.
  get(userId: string): Promise<CachedSubscription | null>
  set(userId: string, value: CachedSubscription): Promise<void>
  invalidate(userId: string): Promise<void>
}
