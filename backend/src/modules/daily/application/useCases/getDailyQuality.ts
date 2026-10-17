import { computeDailyQuality, type DailyQuality } from '../../domain/quality'
import type { DailyResultRepository } from '../ports/dailyResultRepository'

// Números das conquistas por qualidade do Diário (DI.6.1), lidos pelo agregador de progresso de
// `achievements` na hora de avaliar os critérios. Só conta jogada de usuário logado (DI8).
export class GetDailyQualityUseCase {
  constructor(private readonly results: DailyResultRepository) {}

  async execute(input: { userId: string }): Promise<DailyQuality> {
    return computeDailyQuality(await this.results.listByUser(input.userId))
  }
}
