import type { Database } from '../../../../db/client'
import { dailyActivity } from '../../../../db/schema'
import type { ActivityDayRecorder } from '../../application/ports/activityDayRecorder'

export function createDrizzleActivityDayRecorder(db: Database): ActivityDayRecorder {
  return {
    async record(userId, day) {
      await db.insert(dailyActivity).values({ userId, day }).onConflictDoNothing()
    },
  }
}
