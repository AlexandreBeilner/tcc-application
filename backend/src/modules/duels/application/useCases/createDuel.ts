import type { Duel } from '../../domain/duel'
import { invitationExpiry, MAX_SIMULTANEOUS_DUELS } from '../../domain/duel'
import {
  DuelAlreadyOpenError,
  NotFriendsError,
  SelfDuelError,
  TooManyDuelsError,
} from '../../domain/errors'
import type { DuelRepository } from '../ports/duelRepository'
import type { FriendshipChecker } from '../ports/friendshipChecker'

// Desafiar um amigo aceito, até o teto de duelos simultâneos.
export class CreateDuelUseCase {
  constructor(
    private readonly duels: DuelRepository,
    private readonly friendships: FriendshipChecker,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(input: { userId: string; opponentId: string }): Promise<Duel> {
    if (input.userId === input.opponentId) {
      throw new SelfDuelError('você não pode desafiar a si mesmo')
    }
    if (!(await this.friendships.areFriends(input.userId, input.opponentId))) {
      throw new NotFriendsError('só é possível desafiar amigos')
    }
    if (await this.duels.findOpenBetween(input.userId, input.opponentId)) {
      throw new DuelAlreadyOpenError('já existe um duelo em aberto entre vocês dois')
    }
    const now = this.now()
    const duel = await this.duels.createIfRoom(
      {
        challengerId: input.userId,
        opponentId: input.opponentId,
        now,
        expiresAt: invitationExpiry(now),
      },
      MAX_SIMULTANEOUS_DUELS,
    )
    if (!duel) {
      throw new TooManyDuelsError(
        `você já tem ${MAX_SIMULTANEOUS_DUELS} duelos em andamento; espere um terminar para desafiar de novo`,
      )
    }
    return duel
  }
}
