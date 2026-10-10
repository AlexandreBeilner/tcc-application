import { apiRequest } from '../client'
import type { EmailCategory, EmailPreferences, EmailPreferencesResult } from './types'

export type { EmailCategory, EmailPreferences, EmailPreferencesResult, EmailSuppression } from './types'

// Preferências de e-mail (EM.6.1, `.docs/backend/notifications.md`). Tudo nasce desligado.
export function getEmailPreferences(token: string): Promise<EmailPreferencesResult> {
    return apiRequest<EmailPreferencesResult>('/me/email-preferences', { token })
}

// Só as categorias informadas mudam; devolve o estado final.
export function updateEmailPreferences(token: string, changes: Partial<EmailPreferences>): Promise<{ preferences: EmailPreferences }> {
    return apiRequest<{ preferences: EmailPreferences }>('/me/email-preferences', { method: 'PATCH', body: changes, token })
}

// Cancelar inscrição pelo link do e-mail, sem login: o token (do fragmento da página) é a
// autorização. 400 = link inválido.
export function unsubscribeByToken(token: string): Promise<{ status: string; category: EmailCategory }> {
    return apiRequest<{ status: string; category: EmailCategory }>('/email/unsubscribe', { method: 'POST', body: { token } })
}
