import type { League, LeagueWindow } from '../../domain/league'
import { MAX_OPEN_LEAGUES_PER_OWNER, normalizeLeagueName } from '../../domain/league'
import { LeagueLimitReachedError } from '../../domain/errors'
import type { LeagueRepository } from '../ports/leagueRepository'

export interface CreateLeagueInput {
  userId: string
  name: string
  window: LeagueWindow
}

// Qualquer pessoa cria uma liga, até o teto de ligas abertas por dono.
export class CreateLeagueUseCase {
  constructor(
    private readonly leagues: LeagueRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(input: CreateLeagueInput): Promise<League> {
    const name = normalizeLeagueName(input.name)
    const league = await this.leagues.createIfUnderLimit(
      { ownerId: input.userId, name, window: input.window, now: this.now() },
      MAX_OPEN_LEAGUES_PER_OWNER,
    )
    if (!league) {
      throw new LeagueLimitReachedError(
        `você já tem ${MAX_OPEN_LEAGUES_PER_OWNER} ligas abertas; encerre uma para criar outra`,
      )
    }
    return league
  }
}
