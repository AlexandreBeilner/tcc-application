import { monthRange, previousMonth } from '../../domain/retrospective'
import type { MonthActivityReader } from '../ports/monthActivityReader'
import type { RetrospectiveRepository } from '../ports/retrospectiveRepository'
import type { GenerateRetrospectiveUseCase } from './getRetrospective'

export interface MonthlyRunSummary {
  month: string
  generated: number
  skipped: number
  failed: number
}

// Job mensal (MO.5.4): gera e arquiva a retrospectiva do mês que acabou para todas as contas
// ativas que ainda não têm. Idempotente: rodar todo dia (ou duas vezes ao mesmo tempo) não
// repete nada. Uma conta que falha não para as outras e é tentada de novo na rodada seguinte.
export class GenerateMonthlyRetrospectivesUseCase {
  constructor(
    private readonly activity: MonthActivityReader,
    private readonly repository: RetrospectiveRepository,
    private readonly generate: GenerateRetrospectiveUseCase,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(): Promise<MonthlyRunSummary> {
    const month = previousMonth(this.now())
    const [userIds, done] = await Promise.all([
      this.activity.listActiveUserIds(),
      this.repository.listUserIdsWith(month),
    ])
    const summary: MonthlyRunSummary = { month, generated: 0, skipped: 0, failed: 0 }
    for (const userId of userIds) {
      if (done.has(userId)) {
        summary.skipped += 1
        continue
      }
      // Conta criada depois do mês: não existe retrospectiva dele.
      const createdAt = await this.activity.findCreatedAt(userId)
      if (!createdAt || createdAt.getTime() >= monthRange(month).endExclusive.getTime()) {
        summary.skipped += 1
        continue
      }
      try {
        await this.generate.execute(userId, month)
        summary.generated += 1
      } catch {
        summary.failed += 1
      }
    }
    return summary
  }
}
