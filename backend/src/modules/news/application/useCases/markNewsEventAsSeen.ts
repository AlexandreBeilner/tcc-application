import type { NewsReadRepository } from '../ports/newsReadRepository'

export interface MarkNewsEventAsSeenInput {
  userId: string
  macroEventId: string
}

// Idempotente por construção — a port persiste via upsert (ON CONFLICT DO
// NOTHING, mesmo padrão de AchievementRepository.unlock), então não há
// check-then-act aqui. Não valida se `macroEventId` existe de fato no motor
// (banco "market", dono é o motor) — se não existir, a linha só nunca
// entra no join de `listSeenEventIds`, sem efeito colateral.
export class MarkNewsEventAsSeenUseCase {
  constructor(private readonly newsReadRepository: NewsReadRepository) {}

  async execute(input: MarkNewsEventAsSeenInput): Promise<void> {
    await this.newsReadRepository.markAsSeen(input.userId, input.macroEventId)
  }
}
