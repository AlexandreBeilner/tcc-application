import { eq } from 'drizzle-orm'
import type { Database } from '../../../../db/client'
import { emailPreferences } from '../../../../db/schema'
import type { EmailPreferencesRepository } from '../../application/ports/emailPreferencesRepository'
import { DEFAULT_EMAIL_PREFERENCES } from '../../domain/emailPreferences'

export function createDrizzleEmailPreferencesRepository(db: Database): EmailPreferencesRepository {
  return {
    async get(userId) {
      const [row] = await db
        .select({ social: emailPreferences.social, engagement: emailPreferences.engagement })
        .from(emailPreferences)
        .where(eq(emailPreferences.userId, userId))
        .limit(1)
      return row ?? { ...DEFAULT_EMAIL_PREFERENCES }
    },

    async update(userId, changes, now) {
      const [row] = await db
        .insert(emailPreferences)
        .values({ userId, ...DEFAULT_EMAIL_PREFERENCES, ...changes, updatedAt: now })
        .onConflictDoUpdate({
          target: emailPreferences.userId,
          set: { ...changes, updatedAt: now },
        })
        .returning({ social: emailPreferences.social, engagement: emailPreferences.engagement })
      return row
    },

    async deleteForUser(userId) {
      await db.delete(emailPreferences).where(eq(emailPreferences.userId, userId))
    },
  }
}
