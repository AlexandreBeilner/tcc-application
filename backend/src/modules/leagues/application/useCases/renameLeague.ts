import { normalizeLeagueName } from '../../domain/league'
import { loadLeagueForOwner } from '../leagueAccess'
import type { LeagueRepository } from '../ports/leagueRepository'
import type { ProAccess } from '../ports/proAccess'

// Renomear é gerenciamento de liga: exige PRO ativo do dono.
export class RenameLeagueUseCase {
  constructor(
    private readonly access: ProAccess,
    private readonly leagues: LeagueRepository,
  ) {}

  async execute(input: { userId: string; leagueId: string; name: string }): Promise<void> {
    await this.access.assertPro(input.userId)
    await loadLeagueForOwner(this.leagues, input.leagueId, input.userId)
    await this.leagues.rename(input.leagueId, normalizeLeagueName(input.name))
  }
}
