import type { EraseEmailDataUseCase } from '../../../notifications/application/useCases/eraseEmailData'
import type { GetEmailPreferencesUseCase } from '../../../notifications/application/useCases/getEmailPreferences'
import type { EmailDataEraser } from '../../application/ports/emailDataEraser'
import type { EmailPreferencesExporter } from '../../application/ports/emailPreferencesExporter'

// Adapters em processo sobre o módulo `notifications` (mesmo desenho dos outros exportadores).
export function createInProcessEmailPreferencesExporter(
  getEmailPreferences: GetEmailPreferencesUseCase,
): EmailPreferencesExporter {
  return {
    async exportForUser(userId) {
      const { preferences } = await getEmailPreferences.execute({ userId })
      return preferences
    },
  }
}

export function createInProcessEmailDataEraser(
  eraseEmailData: EraseEmailDataUseCase,
): EmailDataEraser {
  return {
    async eraseForUser(userId) {
      await eraseEmailData.execute({ userId })
    },
  }
}
