// Vocabulário do módulo de e-mail (EM.1.1). Categoria decide obrigatoriedade: segurança e
// transacional nunca são desligáveis pelo usuário; social e engajamento exigem opt-in (EM.6.1).
export const EMAIL_CATEGORIES = ['security', 'transactional', 'social', 'engagement'] as const
export type EmailCategory = (typeof EMAIL_CATEGORIES)[number]

export const OUTBOX_STATUSES = ['pending', 'sending', 'sent', 'failed', 'suppressed'] as const
export type OutboxStatus = (typeof OUTBOX_STATUSES)[number]

export interface RenderedEmail {
  subject: string
  html: string
  text: string
  // Cabeçalhos extras (ex.: List-Unsubscribe nos não transacionais, EM.1.3).
  headers?: Record<string, string>
}

// Linha do outbox como o worker a enxerga. `payload` guarda só o que o template precisa.
export interface OutboxEmail {
  id: string
  userId: string | null
  toAddress: string
  templateKey: string
  category: EmailCategory
  payload: Record<string, unknown>
  idempotencyKey: string
  status: OutboxStatus
  attempts: number
  nextAttemptAt: Date
}

// Fluxo de envio (remetente e chave próprios no provedor): segurança e transacional saem pelo
// `transactional`; só as opcionais (social e engajamento) saem pelo `news`.
export type EmailStream = 'transactional' | 'news'

export function streamFor(category: EmailCategory): EmailStream {
  return category === 'social' || category === 'engagement' ? 'news' : 'transactional'
}

export type OptionalEmailCategory = 'social' | 'engagement'

export function isOptionalCategory(category: EmailCategory): category is OptionalEmailCategory {
  return category === 'social' || category === 'engagement'
}

export function normalizeAddress(address: string): string {
  return address.trim().toLowerCase()
}

// `.invalid` é o TLD reservado (RFC 2606) que a anonimização de conta usa
// (`usuario-removido-<id>@anonimo.invalid`): nunca entregável, recusado por construção.
export function isUndeliverableAddress(address: string): boolean {
  const domain = address.slice(address.lastIndexOf('@') + 1)
  return domain === 'invalid' || domain.endsWith('.invalid')
}
