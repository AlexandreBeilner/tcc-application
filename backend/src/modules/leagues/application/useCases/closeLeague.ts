import { loadLeagueForOwner } from '../leagueAccess'
import type { LeagueRepository } from '../ports/leagueRepository'

// Encerrar a própria liga libera a vaga das 3 e não apaga nada: a liga só deixa de
// aparecer nas listagens.
export class CloseLeagueUseCase {
  constructor(
    private readonly leagues: LeagueRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(input: { userId: string; leagueId: string }): Promise<void> {
    await loadLeagueForOwner(this.leagues, input.leagueId, input.userId)
    await this.leagues.close(input.leagueId, this.now())
  }
}
