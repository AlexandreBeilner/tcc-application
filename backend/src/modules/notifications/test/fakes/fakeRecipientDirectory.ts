import type { RecipientDirectory } from '../../application/ports/recipientDirectory'
import type { RecipientInfo } from '../../domain/emailPreferences'

export function createFakeRecipientDirectory(
  recipients: Record<string, RecipientInfo> = {},
): RecipientDirectory & { recipients: Map<string, RecipientInfo> } {
  const map = new Map(Object.entries(recipients))
  return {
    recipients: map,
    async find(userId) {
      return map.get(userId) ?? null
    },
  }
}
