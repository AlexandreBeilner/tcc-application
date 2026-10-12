import { RetrospectiveNotAvailableError } from '../../domain/errors'
import {
  availableMonths,
  isMonthKey,
  longestRun,
  monthRange,
  toView,
  type MonthKey,
  type RetrospectiveData,
  type RetrospectiveView,
} from '../../domain/retrospective'
import type { MonthActivityReader } from '../ports/monthActivityReader'
import type { MonthReturnReader } from '../ports/monthReturnReader'
import type { ProMembershipReader } from '../ports/proMembershipReader'
import type { RetrospectiveRepository } from '../ports/retrospectiveRepository'

// Monta e arquiva a retrospectiva de um mês fechado. Idempotente: se já existe, devolve a gravada
// (nunca recalcula, então rever um mês antigo dá sempre o mesmo resultado). Usado pela leitura
// sob demanda e pelo job mensal.
export class GenerateRetrospectiveUseCase {
  constructor(
    private readonly activity: MonthActivityReader,
    private readonly returns: MonthReturnReader,
    private readonly repository: RetrospectiveRepository,
  ) {}

  async execute(userId: string, month: MonthKey): Promise<RetrospectiveData> {
    const existing = await this.repository.find(userId, month)
    if (existing) return existing

    const range = monthRange(month)
    const read = await this.activity.read(userId, range)

    // Sem a rentabilidade (motor fora do ar) nada é gravado e a chamada falha: o arquivo nunca é
    // recalculado depois, então não pode nascer incompleto. A próxima leitura ou o próximo
    // ciclo do job tenta de novo.
    const bestReturnPct = await this.returns.returnPct(userId, range.start, range.endExclusive)

    const data: RetrospectiveData = {
      month,
      lessonsCompleted: read.lessonsCompleted,
      achievementsUnlocked: read.achievementNames.length,
      achievementNames: read.achievementNames.slice(0, 5),
      level: read.level,
      activeDays: read.activeDays,
      daysInMonth: range.daysInMonth,
      longestStreak: longestRun(read.activeDays),
      bestReturnPct,
      duelsPlayed: read.duelsPlayed,
      duelsWon: read.duelsWon,
      leaguesActive: read.leaguesActive,
    }
    return this.repository.saveIfAbsent(userId, month, data)
  }
}

export interface RetrospectiveList {
  // Mais recentes primeiro.
  months: MonthKey[]
}

export class ListRetrospectiveMonthsUseCase {
  constructor(
    private readonly activity: MonthActivityReader,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(userId: string): Promise<RetrospectiveList> {
    const createdAt = await this.activity.findCreatedAt(userId)
    if (!createdAt) return { months: [] }
    return { months: availableMonths(createdAt, this.now()) }
  }
}

// Leitura de uma retrospectiva. O plano é consultado a cada leitura (nunca claim de JWT): quem
// não é PRO recebe só a versão simples, e o conteúdo completo sai do servidor só para PRO. O
// arquivo guarda sempre o completo, então quem assina depois vê os meses antigos inteiros.
export class GetRetrospectiveUseCase {
  constructor(
    private readonly generate: GenerateRetrospectiveUseCase,
    private readonly list: ListRetrospectiveMonthsUseCase,
    private readonly membership: ProMembershipReader,
  ) {}

  async execute(userId: string, month: string): Promise<RetrospectiveView> {
    if (!isMonthKey(month)) {
      throw new RetrospectiveNotAvailableError('mês inválido, use AAAA-MM')
    }
    const { months } = await this.list.execute(userId)
    if (!months.includes(month)) {
      throw new RetrospectiveNotAvailableError('não há retrospectiva para esse mês')
    }
    const [data, proIds] = await Promise.all([
      this.generate.execute(userId, month),
      this.membership.listProUserIds([userId]),
    ])
    return toView(data, proIds.has(userId))
  }
}
