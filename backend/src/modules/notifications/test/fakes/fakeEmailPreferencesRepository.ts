import type { EmailPreferencesRepository } from '../../application/ports/emailPreferencesRepository'
import { DEFAULT_EMAIL_PREFERENCES, type EmailPreferences } from '../../domain/emailPreferences'

export interface FakeEmailPreferencesRepository extends EmailPreferencesRepository {
  rows: Map<string, EmailPreferences>
}

export function createFakeEmailPreferencesRepository(
  initial: Record<string, Partial<EmailPreferences>> = {},
): FakeEmailPreferencesRepository {
  const rows = new Map<string, EmailPreferences>(
    Object.entries(initial).map(([id, prefs]) => [id, { ...DEFAULT_EMAIL_PREFERENCES, ...prefs }]),
  )
  return {
    rows,
    async get(userId) {
      return { ...(rows.get(userId) ?? DEFAULT_EMAIL_PREFERENCES) }
    },
    async update(userId, changes) {
      const next = { ...(rows.get(userId) ?? DEFAULT_EMAIL_PREFERENCES), ...changes }
      rows.set(userId, next)
      return { ...next }
    },
    async deleteForUser(userId) {
      rows.delete(userId)
    },
  }
}
