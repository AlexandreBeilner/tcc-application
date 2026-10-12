import type { ProLifecycleEmail } from '../../domain/lifecycleEmails'

// Avisos por e-mail do ciclo de vida do PRO (MO.3.4). Port do módulo, implementada na composição
// por um adapter sobre `modules/notifications`: quem sincroniza a assinatura nunca conhece o
// outbox. Idempotência por `email.key` é responsabilidade do adapter.
export interface BillingMailer {
  send(userId: string, email: ProLifecycleEmail): Promise<void>
}
