import type { League, LeagueWindow } from '../../domain/league'
import { MAX_OPEN_LEAGUES_PER_OWNER, normalizeLeagueName } from '../../domain/league'
import { LeagueLimitReachedError } from '../../domain/errors'
import type { LeagueRepository } from '../ports/leagueRepository'
import type { ProAccess } from '../ports/proAccess'

export interface CreateLeagueInput {
  userId: string
  name: string
  window: LeagueWindow
}

// Criar liga é capacidade PRO (403 sem plano ativo); participar nunca exige.
export class CreateLeagueUseCase {
  constructor(
    private readonly access: ProAccess,
    private readonly leagues: LeagueRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(input: CreateLeagueInput): Promise<League> {
    await this.access.assertPro(input.userId)
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
