import type { Database } from '../../db/client'
import type { AuthMiddleware } from '../../shared/http/authMiddleware'
import { GenerateMonthlyRetrospectivesUseCase } from './application/useCases/generateMonthlyRetrospectives'
import {
  GenerateRetrospectiveUseCase,
  GetRetrospectiveUseCase,
  ListRetrospectiveMonthsUseCase,
} from './application/useCases/getRetrospective'
import { createInProcessProMembershipReader } from './infrastructure/billing/inProcessProMembershipReader'
import { createDrizzleMonthActivityReader } from './infrastructure/persistence/drizzleMonthActivityReader'
import { createDrizzleRetrospectiveRepository } from './infrastructure/persistence/drizzleRetrospectiveRepository'
import { createInProcessMonthReturnReader } from './infrastructure/ranking/inProcessMonthReturnReader'
import { createRetrospectivesRouter } from './interfaces/http/retrospectivesRouter'

export interface RetrospectivesCompositionDeps {
  db: Database
  authMiddleware: AuthMiddleware
  // Do módulo `billing`: quem é PRO agora (versão completa só para PRO).
  listActiveProUserIds: { execute(userIds: string[]): Promise<Set<string>> }
  // Do módulo `ranking`: rentabilidade percentual entre dois instantes.
  measurePeriodReturn: {
    execute(input: { userId: string; from: Date; to: Date }): Promise<{ returnPct: number }>
  }
}

// Composição do módulo `retrospectives` (único lugar que instancia os adapters concretos).
// Devolve o router e `generateMonthly`, o job mensal (ligado em `server.ts`).
export function createRetrospectivesModule(deps: RetrospectivesCompositionDeps) {
  const activity = createDrizzleMonthActivityReader(deps.db)
  const repository = createDrizzleRetrospectiveRepository(deps.db)
  const generate = new GenerateRetrospectiveUseCase(
    activity,
    createInProcessMonthReturnReader(deps.measurePeriodReturn),
    repository,
  )
  const list = new ListRetrospectiveMonthsUseCase(activity)
  const router = createRetrospectivesRouter({
    listMonths: list,
    getRetrospective: new GetRetrospectiveUseCase(
      generate,
      list,
      createInProcessProMembershipReader(deps.listActiveProUserIds),
    ),
    authMiddleware: deps.authMiddleware,
  })
  return {
    router,
    generateMonthly: new GenerateMonthlyRetrospectivesUseCase(activity, repository, generate),
  }
}
