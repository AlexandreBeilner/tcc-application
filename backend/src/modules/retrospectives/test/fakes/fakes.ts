import type {
  MonthActivity,
  MonthActivityReader,
} from '../../application/ports/monthActivityReader'
import type { MonthReturnReader } from '../../application/ports/monthReturnReader'
import type { ProMembershipReader } from '../../application/ports/proMembershipReader'
import type { RetrospectiveRepository } from '../../application/ports/retrospectiveRepository'
import type { RetrospectiveData } from '../../domain/retrospective'

export const BASE_ACTIVITY: MonthActivity = {
  lessonsCompleted: 6,
  achievementNames: ['Primeira Semana', 'Estudioso'],
  level: 5,
  activeDays: [1, 2, 3, 9],
  duelsPlayed: 1,
  duelsWon: 1,
  leaguesActive: 2,
}

export function createFakeActivity(
  createdAt: Record<string, Date>,
  activity: Record<string, MonthActivity> = {},
): MonthActivityReader & { reads: number } {
  const fake = {
    reads: 0,
    async read(userId: string) {
      fake.reads++
      return activity[userId] ?? BASE_ACTIVITY
    },
    async findCreatedAt(userId: string) {
      return createdAt[userId] ?? null
    },
    async listActiveUserIds() {
      return Object.keys(createdAt)
    },
  }
  return fake
}

export function createFakeReturns(
  pct: Record<string, number>,
): MonthReturnReader & { failFor: Set<string>; calls: { from: Date; to: Date }[] } {
  const fake = {
    failFor: new Set<string>(),
    calls: [] as { from: Date; to: Date }[],
    async returnPct(userId: string, from: Date, to: Date) {
      fake.calls.push({ from, to })
      if (fake.failFor.has(userId)) throw new Error('motor fora do ar')
      return pct[userId] ?? 0
    },
  }
  return fake
}

export function createFakeRepository(): RetrospectiveRepository & {
  rows: Map<string, RetrospectiveData>
} {
  const rows = new Map<string, RetrospectiveData>()
  return {
    rows,
    async find(userId, month) {
      return rows.get(`${userId}|${month}`) ?? null
    },
    async saveIfAbsent(userId, month, data) {
      const key = `${userId}|${month}`
      if (!rows.has(key)) rows.set(key, data)
      return rows.get(key) as RetrospectiveData
    },
    async listUserIdsWith(month) {
      return new Set(
        [...rows.keys()].filter((k) => k.endsWith(`|${month}`)).map((k) => k.split('|')[0]),
      )
    },
  }
}

export function createFakeMembership(proIds: string[]): ProMembershipReader & { ids: Set<string> } {
  const ids = new Set(proIds)
  return {
    ids,
    async listProUserIds(userIds) {
      return new Set(userIds.filter((id) => ids.has(id)))
    },
  }
}
