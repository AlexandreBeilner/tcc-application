import type { UserStats, UserStatsReader } from '../../application/ports/userStatsReader'

export interface FakeUserStatsReader extends UserStatsReader {
  errorToThrow?: Error
  lastNow?: Date
}

export const sampleUserStats: UserStats = { total: 42, signups_last_24h: 3, signups_last_7d: 11 }

export function createFakeUserStatsReader(stats: UserStats = sampleUserStats): FakeUserStatsReader {
  const fake: FakeUserStatsReader = {
    errorToThrow: undefined,
    lastNow: undefined,
    async read(now) {
      fake.lastNow = now
      if (fake.errorToThrow) throw fake.errorToThrow
      return stats
    },
  }
  return fake
}
