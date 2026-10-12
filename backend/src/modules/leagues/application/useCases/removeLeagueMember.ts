import { InvitationNotFoundError, OwnerCannotLeaveError } from '../../domain/errors'
import { loadLeagueForOwner } from '../leagueAccess'
import type { LeagueRepository } from '../ports/leagueRepository'

// O dono tira um membro ou cancela um convite pendente. Moderar a própria liga não exige PRO
// ativo (quem cancelou ainda consegue limpar a lista).
export class RemoveLeagueMemberUseCase {
  constructor(private readonly leagues: LeagueRepository) {}

  async execute(input: { userId: string; leagueId: string; targetUserId: string }): Promise<void> {
    await loadLeagueForOwner(this.leagues, input.leagueId, input.userId)
    if (input.targetUserId === input.userId) {
      throw new OwnerCannotLeaveError('quem criou a liga não pode sair; encerre a liga se quiser')
    }
    if (!(await this.leagues.findMember(input.leagueId, input.targetUserId))) {
      throw new InvitationNotFoundError('essa pessoa não está na liga')
    }
    await this.leagues.removeMember(input.leagueId, input.targetUserId)
  }
}
