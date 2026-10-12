import type { Subscription } from '../../domain/subscription'

export interface SubscriptionRepository {
  find(userId: string): Promise<Subscription | null>
  // Leitura em lote (uma query) pra telas que mostram vários usuários de uma vez.
  findMany(userIds: string[]): Promise<Subscription[]>
  // Todas as linhas (uma por quem já assinou alguma vez), pro painel admin. O volume é o de quem
  // paga ou pagou, não o de usuários.
  listAll(): Promise<Subscription[]>
  // Uma linha por usuário: grava ou substitui.
  upsert(subscription: Subscription): Promise<void>
}
