import { normalizeLeagueName } from '../../domain/league'
import { loadLeagueForOwner } from '../leagueAccess'
import type { LeagueRepository } from '../ports/leagueRepository'

// Renomear é gerenciamento de liga: só o dono.
export class RenameLeagueUseCase {
  constructor(private readonly leagues: LeagueRepository) {}

  async execute(input: { userId: string; leagueId: string; name: string }): Promise<void> {
    await loadLeagueForOwner(this.leagues, input.leagueId, input.userId)
    await this.leagues.rename(input.leagueId, normalizeLeagueName(input.name))
  }
}
