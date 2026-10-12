import type { LeagueRepository } from '../../application/ports/leagueRepository'
import type { League, LeagueMember } from '../../domain/league'

export interface FakeLeagueRepository extends LeagueRepository {
  leagues: Map<string, League>
  members: LeagueMember[]
}

export function createFakeLeagueRepository(): FakeLeagueRepository {
  let seq = 0
  const fake: FakeLeagueRepository = {
    leagues: new Map(),
    members: [],
    async createIfUnderLimit(input, maxOpen) {
      const open = [...fake.leagues.values()].filter(
        (l) => l.ownerId === input.ownerId && !l.closedAt,
      )
      if (open.length >= maxOpen) return null
      const league: League = {
        id: `00000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`,
        ownerId: input.ownerId,
        name: input.name,
        window: input.window,
        createdAt: input.now,
        closedAt: null,
      }
      fake.leagues.set(league.id, league)
      fake.members.push({
        leagueId: league.id,
        userId: input.ownerId,
        status: 'active',
        invitedBy: input.ownerId,
        createdAt: input.now,
        joinedAt: input.now,
      })
      return league
    },
    async findById(id) {
      return fake.leagues.get(id) ?? null
    },
    async rename(id, name) {
      const league = fake.leagues.get(id)
      if (league) fake.leagues.set(id, { ...league, name })
    },
    async close(id, at) {
      const league = fake.leagues.get(id)
      if (league) fake.leagues.set(id, { ...league, closedAt: at })
    },
    async listForUser(userId) {
      return fake.members
        .filter((m) => m.userId === userId)
        .flatMap((membership) => {
          const league = fake.leagues.get(membership.leagueId)
          return league && !league.closedAt ? [{ league, membership }] : []
        })
    },
    async listMembers(leagueId) {
      return fake.members.filter((m) => m.leagueId === leagueId)
    },
    async findMember(leagueId, userId) {
      return fake.members.find((m) => m.leagueId === leagueId && m.userId === userId) ?? null
    },
    async addMemberIfRoom(input, maxMembers) {
      if (fake.members.filter((m) => m.leagueId === input.leagueId).length >= maxMembers)
        return false
      fake.members.push({
        leagueId: input.leagueId,
        userId: input.userId,
        status: input.status,
        invitedBy: input.invitedBy,
        createdAt: input.now,
        joinedAt: input.status === 'active' ? input.now : null,
      })
      return true
    },
    async activateMember(leagueId, userId, at) {
      fake.members = fake.members.map((m) =>
        m.leagueId === leagueId && m.userId === userId
          ? { ...m, status: 'active', joinedAt: at }
          : m,
      )
    },
    async removeMember(leagueId, userId) {
      fake.members = fake.members.filter((m) => !(m.leagueId === leagueId && m.userId === userId))
    },
  }
  return fake
}
