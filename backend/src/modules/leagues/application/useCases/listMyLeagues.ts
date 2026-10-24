import type { LeagueMemberStatus, LeagueWindow } from '../../domain/league'
import type { LeagueRepository } from '../ports/leagueRepository'
import type { LeagueUserDirectory } from '../ports/leagueUserDirectory'

export interface LeagueSummary {
  id: string
  name: string
  window: LeagueWindow
  ownerId: string
  ownerUsername: string
  isOwner: boolean
  // `invited` = convite pendente para a pessoa; `active` = participa.
  status: LeagueMemberStatus
  // Pessoas que participam (não conta convites pendentes).
  memberCount: number
}

export class ListMyLeaguesUseCase {
  constructor(
    private readonly leagues: LeagueRepository,
    private readonly users: LeagueUserDirectory,
  ) {}

  async execute(userId: string): Promise<LeagueSummary[]> {
    const rows = await this.leagues.listForUser(userId)
    if (rows.length === 0) return []

    const ownerIds = [...new Set(rows.map((row) => row.league.ownerId))]
    const [owners, memberLists] = await Promise.all([
      this.users.findByIds(ownerIds),
      Promise.all(rows.map((row) => this.leagues.listMembers(row.league.id))),
    ])
    const ownerName = new Map(owners.map((owner) => [owner.id, owner.username]))

    return rows.map(({ league, membership }, index) => ({
      id: league.id,
      name: league.name,
      window: league.window,
      ownerId: league.ownerId,
      ownerUsername: ownerName.get(league.ownerId) ?? '',
      isOwner: league.ownerId === userId,
      status: membership.status,
      memberCount: memberLists[index].filter((member) => member.status === 'active').length,
    }))
  }
}
