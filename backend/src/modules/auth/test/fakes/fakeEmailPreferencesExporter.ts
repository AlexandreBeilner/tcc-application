import type {
  EmailPreferencesExporter,
  ExportedEmailPreferences,
} from '../../application/ports/emailPreferencesExporter'

export function createFakeEmailPreferencesExporter(
  byUserId: Record<string, ExportedEmailPreferences> = {},
): EmailPreferencesExporter {
  return {
    async exportForUser(userId) {
      return byUserId[userId] ?? { social: false, engagement: false }
    },
  }
}
