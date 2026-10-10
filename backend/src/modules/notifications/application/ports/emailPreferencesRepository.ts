import type { EmailPreferences } from '../../domain/emailPreferences'

export interface EmailPreferencesRepository {
  // Sem linha gravada = tudo desligado (`DEFAULT_EMAIL_PREFERENCES`).
  get(userId: string): Promise<EmailPreferences>
  // Grava só as categorias informadas (upsert) e devolve o estado final.
  update(userId: string, changes: Partial<EmailPreferences>, now: Date): Promise<EmailPreferences>
  deleteForUser(userId: string): Promise<void>
}
