import {
  isOptionalCategory,
  isUndeliverableAddress,
  type EmailCategory,
  type OptionalEmailCategory,
} from './emailMessage'

// Preferências de e-mail por categoria opcional (EM.6.1). Segurança e transacional não aparecem
// aqui de propósito: não são desligáveis (reset, verificação, suspensão, exclusão). Tudo nasce
// desligado (D8): ninguém recebe e-mail social ou de engajamento sem ter pedido.
export type EmailPreferences = Record<OptionalEmailCategory, boolean>

export const DEFAULT_EMAIL_PREFERENCES: EmailPreferences = { social: false, engagement: false }

export function isCategoryEnabled(preferences: EmailPreferences, category: EmailCategory): boolean {
  return isOptionalCategory(category) ? preferences[category] : true
}

// O que a regra de elegibilidade precisa saber do destinatário, sem importar o módulo `auth`.
export interface RecipientInfo {
  address: string
  // Nome de exibição, para o "Olá, Ana" dos e-mails (opcional: nem todo leitor precisa dele).
  name?: string
  status: 'active' | 'suspended'
  emailVerified: boolean
}

// E-mail opcional só vai para conta ativa (suspensa recebe apenas o aviso de suspensão), com
// endereço verificado e que não foi anonimizada.
export function isEligibleForOptionalEmail(recipient: RecipientInfo): boolean {
  return (
    recipient.status === 'active' &&
    recipient.emailVerified &&
    !isUndeliverableAddress(recipient.address.trim().toLowerCase())
  )
}
