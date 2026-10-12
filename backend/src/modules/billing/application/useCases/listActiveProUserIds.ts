import { isActive } from '../../domain/subscription'
import type { SubscriptionRepository } from '../ports/subscriptionRepository'

// Quem, dentre estes usuários, é PRO agora. Leitura em lote para telas que mostram vários
// usuários (ranking, feed, busca), onde consultar um a um custaria uma ida ao banco por linha.
// Sem cache de propósito: é uma query por página e a decisão usa sempre a hora de agora.
export class ListActiveProUserIdsUseCase {
  constructor(
    private readonly subscriptions: SubscriptionRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(userIds: string[]): Promise<Set<string>> {
    const unique = [...new Set(userIds)]
    const rows = await this.subscriptions.findMany(unique)
    const now = this.now()
    return new Set(rows.filter((row) => isActive(row, now)).map((row) => row.userId))
  }
}
