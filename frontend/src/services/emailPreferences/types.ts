// Categorias de e-mail que a pessoa pode ligar ou desligar (EM.6.1). Segurança e transacional
// (reset de senha, verificação, avisos da conta) não existem aqui: nunca são desligáveis.
export type EmailCategory = 'social' | 'engagement'

export type EmailPreferences = Record<EmailCategory, boolean>

// Por que o endereço da conta não recebe e-mail (bounce: não entrega; reclamação: marcado como spam).
export type EmailSuppression = 'bounce' | 'complaint' | 'unsubscribe_all'

export interface EmailPreferencesResult {
    preferences: EmailPreferences
    suppression: EmailSuppression | null
}
