import { eq } from 'drizzle-orm'
import type { Database } from '../../../../db/client'
import { dailySettings } from '../../../../db/schema'
import type { DailySettingsRepository } from '../../application/ports/dailySettingsRepository'

export function createDrizzleDailySettingsRepository(db: Database): DailySettingsRepository {
  return {
    async get() {
      const [row] = await db.select().from(dailySettings).where(eq(dailySettings.id, 1)).limit(1)
      // A migration cria a linha; sem ela o Diário é tratado como desligado.
      return row
        ? { startDate: row.startDate, updatedBy: row.updatedBy, updatedAt: row.updatedAt }
        : { startDate: null, updatedBy: null, updatedAt: new Date(0) }
    },

    async setStartDate(startDate, updatedBy, now) {
      await db
        .insert(dailySettings)
        .values({ id: 1, startDate, updatedBy, updatedAt: now })
        .onConflictDoUpdate({
          target: dailySettings.id,
          set: { startDate, updatedBy, updatedAt: now },
        })
    },
  }
}
