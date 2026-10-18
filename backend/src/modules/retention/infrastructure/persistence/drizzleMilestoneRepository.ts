import type { Database } from '../../../../db/client'
import { userMilestones } from '../../../../db/schema'
import type { MilestoneRepository } from '../../application/ports/milestoneRepository'

export function createDrizzleMilestoneRepository(db: Database): MilestoneRepository {
  return {
    async recordIfAbsent(userId, milestone, reachedAt) {
      await db
        .insert(userMilestones)
        .values({ userId, milestone, reachedAt })
        .onConflictDoNothing({ target: [userMilestones.userId, userMilestones.milestone] })
    },
  }
}
