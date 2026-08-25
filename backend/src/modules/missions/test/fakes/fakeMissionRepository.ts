import type { MissionRepository } from '../../application/ports/missionRepository'
import type { Mission, MissionProgressSnapshot } from '../../domain/mission'

export function createFakeMissionRepository(seedCatalog: Mission[] = []): MissionRepository {
  const catalog = [...seedCatalog]
  // key: `${userId}|${missionId}|${missionDate}`
  const progress = new Map<string, MissionProgressSnapshot>()

  return {
    async listCatalog() {
      return [...catalog]
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
      progress.set(`${userId}|${missionId}|${missionDate}`, { status: 'completed' })
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
