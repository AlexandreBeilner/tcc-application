import { OwnerCannotLeaveError } from '../../domain/errors'
import { loadLeagueForMember } from '../leagueAccess'
import type { LeagueRepository } from '../ports/leagueRepository'

// Sair da liga (ou desistir de um convite). O dono não sai: encerra a liga.
export class LeaveLeagueUseCase {
  constructor(private readonly leagues: LeagueRepository) {}

  async execute(input: { userId: string; leagueId: string }): Promise<void> {
    const { league } = await loadLeagueForMember(this.leagues, input.leagueId, input.userId)
    if (league.ownerId === input.userId) {
      throw new OwnerCannotLeaveError('quem criou a liga não pode sair; encerre a liga se quiser')
    }
    await this.leagues.removeMember(input.leagueId, input.userId)
  }
}
