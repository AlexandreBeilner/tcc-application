import type { FriendshipChecker } from '../../application/ports/friendshipChecker'
import type { LeagueScoreReader, LeagueScore } from '../../application/ports/leagueScoreReader'
import type { LeagueUser, LeagueUserDirectory } from '../../application/ports/leagueUserDirectory'

export function createFakeFriendships(pairs: [string, string][]): FriendshipChecker {
  return {
    async areFriends(a, b) {
      return pairs.some(([x, y]) => (x === a && y === b) || (x === b && y === a))
    },
  }
}

export function createFakeUsers(ids: string[]): LeagueUserDirectory {
  const users: LeagueUser[] = ids.map((id) => ({
    id,
    username: id,
    name: id.toUpperCase(),
    avatarUrl: null,
  }))
  return { findByIds: async (wanted) => users.filter((u) => wanted.includes(u.id)) }
}

export function createFakeScores(
  pctByUser: Record<string, number>,
): LeagueScoreReader & { calls: { userIds: string[]; window: string }[] } {
  const calls: { userIds: string[]; window: string }[] = []
  return {
    calls,
    async rank(userIds, window) {
      calls.push({ userIds, window })
      const scores: LeagueScore[] = userIds
        .filter((id) => id in pctByUser)
        .map((id) => ({ userId: id, level: 3, profitabilityPct: pctByUser[id] }))
        .sort((a, b) => b.profitabilityPct - a.profitabilityPct)
      return { scores, updatedAt: null }
    },
  }
}
