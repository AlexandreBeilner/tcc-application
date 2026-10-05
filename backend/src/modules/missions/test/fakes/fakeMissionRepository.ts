import type {
  MissionCompletionCount,
  MissionRepository,
} from '../../application/ports/missionRepository'
import type { Mission, MissionProgressSnapshot } from '../../domain/mission'

export function createFakeMissionRepository(seedCatalog: Mission[] = []): MissionRepository {
  const catalog = [...seedCatalog]
  // key: `${userId}|${missionId}|${missionDate}`
  const progress = new Map<string, MissionProgressSnapshot>()

  return {
    async listCatalog() {
      return catalog.filter((mission) => mission.isActive)
    },

    async listAll() {
      return [...catalog]
    },

    async update(id, patch) {
      const index = catalog.findIndex((mission) => mission.id === id)
      if (index < 0) return undefined
      const merged = { ...catalog[index] }
      for (const [key, value] of Object.entries(patch)) {
        if (value !== undefined) Object.assign(merged, { [key]: value })
      }
      catalog[index] = merged
      return merged
    },

    async countCompletions(today: string) {
      const users = new Map<string, Set<string>>()
      const usersToday = new Map<string, Set<string>>()
      for (const [key, snapshot] of progress.entries()) {
        if (snapshot.status !== 'completed') continue
        const [userId, missionId, missionDate] = key.split('|')
        if (!users.has(missionId)) users.set(missionId, new Set())
        users.get(missionId)?.add(userId)
        if (missionDate === today) {
          if (!usersToday.has(missionId)) usersToday.set(missionId, new Set())
          usersToday.get(missionId)?.add(userId)
        }
      }
      const counts = new Map<string, MissionCompletionCount>()
      for (const [missionId, set] of users.entries()) {
        counts.set(missionId, { users: set.size, today: usersToday.get(missionId)?.size ?? 0 })
      }
      return counts
    },

    async findById(id) {
      return catalog.find((mission) => mission.id === id)
    },

    async ensureTodayProgress(userId: string, missionIds: string[], missionDate: string) {
      for (const missionId of missionIds) {
        const key = `${userId}|${missionId}|${missionDate}`
        if (!progress.has(key)) {
          progress.set(key, { status: 'pending' })
        }
      }
    },

    async listProgressForDate(userId: string, missionDate: string) {
      return [...progress.entries()]
        .filter(([key]) => key.startsWith(`${userId}|`) && key.endsWith(`|${missionDate}`))
        .map(([key, snapshot]) => ({ missionId: key.split('|')[1], ...snapshot }))
    },

    async findProgress(userId: string, missionId: string, missionDate: string) {
      return progress.get(`${userId}|${missionId}|${missionDate}`)
    },

    async markCompleted(userId: string, missionId: string, missionDate: string) {
      const key = `${userId}|${missionId}|${missionDate}`
      if (progress.get(key)?.status === 'completed') {
        return false
      }
      progress.set(key, { status: 'completed' })
      return true
    },

    async listAllProgressForUser(userId: string) {
      return [...progress.entries()]
        .filter(([key]) => key.startsWith(`${userId}|`))
        .map(([key, snapshot]) => {
          const [, missionId, missionDate] = key.split('|')
          return { missionId, missionDate, status: snapshot.status, completedAt: null }
        })
    },
  }
}
