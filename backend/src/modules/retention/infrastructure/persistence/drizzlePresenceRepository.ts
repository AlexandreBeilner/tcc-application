import type { Database } from '../../../../db/client'
import { dailyPresence } from '../../../../db/schema'
import type { PresenceRepository } from '../../application/ports/presenceRepository'

export function createDrizzlePresenceRepository(db: Database): PresenceRepository {
  return {
    async record(userId, day) {
      await db.insert(dailyPresence).values({ userId, day }).onConflictDoNothing()
    },
  }
}
