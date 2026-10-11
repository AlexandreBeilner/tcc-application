import { InvitationNotFoundError, JoinedLeaguesLimitReachedError } from '../../domain/errors'
import { MAX_JOINED_LEAGUES_PER_USER } from '../../domain/league'
import { loadLeagueForMember } from '../leagueAccess'
import type { LeagueRepository } from '../ports/leagueRepository'

// Aceitar ou recusar convite. Nunca exige PRO: o membro gratuito entra na liga de um amigo.
export class RespondToLeagueInvitationUseCase {
  constructor(
    private readonly leagues: LeagueRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(input: { userId: string; leagueId: string; accept: boolean }): Promise<void> {
    const { membership } = await loadLeagueForMember(this.leagues, input.leagueId, input.userId)
    if (membership.status !== 'invited') {
      throw new InvitationNotFoundError('não há convite pendente para você nessa liga')
    }
    if (input.accept) {
      const mine = await this.leagues.listForUser(input.userId)
      const joined = mine.filter((row) => row.membership.status === 'active').length
      if (joined >= MAX_JOINED_LEAGUES_PER_USER) {
        throw new JoinedLeaguesLimitReachedError(
          `você já participa de ${MAX_JOINED_LEAGUES_PER_USER} ligas; saia de uma para entrar em outra`,
        )
      }
      await this.leagues.activateMember(input.leagueId, input.userId, this.now())
    } else {
      await this.leagues.removeMember(input.leagueId, input.userId)
    }
  }
}
