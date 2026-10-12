import type { Database } from '../../db/client'
import type { AuthMiddleware } from '../../shared/http/authMiddleware'
import type { CosmeticsReader } from '../../shared/publicCosmetics'
import type { FriendshipRepository } from '../friendships/application/ports/friendshipRepository'
import type { RankedGroup } from '../ranking/application/useCases/rankUsersByProfitability'
import type { ProAccess } from './application/ports/proAccess'
import { CloseLeagueUseCase } from './application/useCases/closeLeague'
import { CreateLeagueUseCase } from './application/useCases/createLeague'
import { GetLeagueUseCase } from './application/useCases/getLeague'
import { InviteToLeagueUseCase } from './application/useCases/inviteToLeague'
import { LeaveLeagueUseCase } from './application/useCases/leaveLeague'
import { ListMyLeaguesUseCase } from './application/useCases/listMyLeagues'
import { RemoveLeagueMemberUseCase } from './application/useCases/removeLeagueMember'
import { RenameLeagueUseCase } from './application/useCases/renameLeague'
import { RespondToLeagueInvitationUseCase } from './application/useCases/respondToLeagueInvitation'
import { createInProcessProMembershipReader } from './infrastructure/billing/inProcessProMembershipReader'
import { createInProcessFriendshipChecker } from './infrastructure/friendships/inProcessFriendshipChecker'
import { createDrizzleLeagueRepository } from './infrastructure/persistence/drizzleLeagueRepository'
import { createDrizzleLeagueUserDirectory } from './infrastructure/persistence/drizzleLeagueUserDirectory'
import { createInProcessLeagueScoreReader } from './infrastructure/ranking/inProcessLeagueScoreReader'
import { createLeaguesRouter } from './interfaces/http/leaguesRouter'

export interface LeaguesCompositionDeps {
  db: Database
  authMiddleware: AuthMiddleware
  // Do módulo `billing`: gate de PRO e leitura em lote de quem é PRO.
  proAccess: ProAccess
  listActiveProUserIds: { execute(userIds: string[]): Promise<Set<string>> }
  // Do módulo `friendships`: convite só entre amizades aceitas.
  friendshipRepository: Pick<FriendshipRepository, 'findByPair'>
  // Do módulo `ranking`: pontuação por rentabilidade percentual da janela oficial.
  rankUsers: {
    execute(input: { userIds: string[]; window: 'week' | 'month' }): Promise<RankedGroup>
  }
  cosmeticsReader: CosmeticsReader
}

// Composição do módulo `leagues` (único lugar que instancia os adapters concretos).
export function createLeaguesModule(deps: LeaguesCompositionDeps) {
  const repo = createDrizzleLeagueRepository(deps.db)
  const users = createDrizzleLeagueUserDirectory(deps.db)
  const membership = createInProcessProMembershipReader(deps.listActiveProUserIds)

  const router = createLeaguesRouter({
    createLeague: new CreateLeagueUseCase(deps.proAccess, repo),
    listMyLeagues: new ListMyLeaguesUseCase(repo, membership, users),
    getLeague: new GetLeagueUseCase(
      repo,
      createInProcessLeagueScoreReader(deps.rankUsers),
      membership,
      users,
      deps.cosmeticsReader,
    ),
    renameLeague: new RenameLeagueUseCase(deps.proAccess, repo),
    closeLeague: new CloseLeagueUseCase(repo),
    inviteToLeague: new InviteToLeagueUseCase(
      deps.proAccess,
      repo,
      createInProcessFriendshipChecker(deps.friendshipRepository),
    ),
    respondToInvitation: new RespondToLeagueInvitationUseCase(repo),
    leaveLeague: new LeaveLeagueUseCase(repo),
    removeMember: new RemoveLeagueMemberUseCase(repo),
    authMiddleware: deps.authMiddleware,
  })
  return { router }
}
