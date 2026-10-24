import { MAX_LEAGUE_MEMBERS } from '../../domain/league'
import { AlreadyInLeagueError, LeagueFullError, NotFriendsError } from '../../domain/errors'
import { loadLeagueForOwner } from '../leagueAccess'
import type { FriendshipChecker } from '../ports/friendshipChecker'
import type { LeagueRepository } from '../ports/leagueRepository'

// O dono convida um amigo aceito.
export class InviteToLeagueUseCase {
  constructor(
    private readonly leagues: LeagueRepository,
    private readonly friendships: FriendshipChecker,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(input: { userId: string; leagueId: string; targetUserId: string }): Promise<void> {
    const league = await loadLeagueForOwner(this.leagues, input.leagueId, input.userId)

    if (!(await this.friendships.areFriends(input.userId, input.targetUserId))) {
      throw new NotFriendsError('só é possível convidar amigos')
    }
    if (await this.leagues.findMember(league.id, input.targetUserId)) {
      throw new AlreadyInLeagueError('essa pessoa já está na liga ou já foi convidada')
    }
    const added = await this.leagues.addMemberIfRoom(
      {
        leagueId: league.id,
        userId: input.targetUserId,
        status: 'invited',
        invitedBy: input.userId,
        now: this.now(),
      },
      MAX_LEAGUE_MEMBERS,
    )
    if (!added) throw new LeagueFullError(`a liga já tem ${MAX_LEAGUE_MEMBERS} pessoas`)
  }
}
