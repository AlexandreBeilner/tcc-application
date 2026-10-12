import type { Database } from '../../db/client'
import type { AuthMiddleware } from '../../shared/http/authMiddleware'
import type { CosmeticsReader } from '../../shared/publicCosmetics'
import type { FriendshipRepository } from '../friendships/application/ports/friendshipRepository'
import type { PeriodReturn } from '../ranking/application/useCases/measurePeriodReturn'
import type { ProAccess } from './application/ports/proAccess'
import { CancelDuelUseCase } from './application/useCases/cancelDuel'
import { CreateDuelUseCase } from './application/useCases/createDuel'
import { GetDuelUseCase } from './application/useCases/getDuel'
import { ListMyDuelsUseCase } from './application/useCases/listMyDuels'
import { RespondToDuelUseCase } from './application/useCases/respondToDuel'
import { SettleDueDuelsUseCase } from './application/useCases/settleDueDuels'
import { createInProcessFriendshipChecker } from './infrastructure/friendships/inProcessFriendshipChecker'
import { createInProcessXpGrant } from './infrastructure/gamification/inProcessXpGrant'
import { createDrizzleDuelRepository } from './infrastructure/persistence/drizzleDuelRepository'
import { createDrizzleDuelUserDirectory } from './infrastructure/persistence/drizzleDuelUserDirectory'
import { createInProcessDuelPerformanceReader } from './infrastructure/ranking/inProcessDuelPerformanceReader'
import { createInProcessDuelFeedRecorder } from './infrastructure/socialfeed/inProcessDuelFeedRecorder'
import { createDuelsRouter } from './interfaces/http/duelsRouter'

export interface DuelsCompositionDeps {
  db: Database
  authMiddleware: AuthMiddleware
  // Do módulo `billing`: gate de PRO (só desafiar exige; aceitar nunca).
  proAccess: ProAccess
  // Do módulo `friendships`: duelo só entre amizades aceitas.
  friendshipRepository: Pick<FriendshipRepository, 'findByPair'>
  // Do módulo `ranking`: rentabilidade percentual entre dois instantes.
  measurePeriodReturn: {
    execute(input: { userId: string; from: Date; to: Date }): Promise<PeriodReturn>
  }
  // Do módulo `gamification`: crédito de XP de participação.
  awardXp: { execute(input: { userId: string; amount: number; reason: string }): Promise<unknown> }
  // Do módulo `socialfeed`: resultado do duelo vira item do feed.
  recordDuelResult: Parameters<typeof createInProcessDuelFeedRecorder>[0]
  cosmeticsReader: CosmeticsReader
}

// Composição do módulo `duels` (único lugar que instancia os adapters concretos). Devolve o router
// e `settleDueDuels`, o job que encerra os duelos vencidos (ligado em `server.ts`).
export function createDuelsModule(deps: DuelsCompositionDeps) {
  const repo = createDrizzleDuelRepository(deps.db)
  const users = createDrizzleDuelUserDirectory(deps.db)
  const performance = createInProcessDuelPerformanceReader(deps.measurePeriodReturn)

  const getDuel = new GetDuelUseCase(repo, performance, users, deps.cosmeticsReader)
  const router = createDuelsRouter({
    createDuel: new CreateDuelUseCase(
      deps.proAccess,
      repo,
      createInProcessFriendshipChecker(deps.friendshipRepository),
    ),
    respondToDuel: new RespondToDuelUseCase(repo),
    cancelDuel: new CancelDuelUseCase(repo),
    listMyDuels: new ListMyDuelsUseCase(repo, users, deps.cosmeticsReader),
    getDuel,
    authMiddleware: deps.authMiddleware,
  })
  const settleDueDuels = new SettleDueDuelsUseCase(
    repo,
    performance,
    users,
    createInProcessXpGrant(deps.awardXp),
    createInProcessDuelFeedRecorder(deps.recordDuelResult),
  )
  return { router, settleDueDuels }
}
