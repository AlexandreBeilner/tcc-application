import type { Database } from '../../db/client'
import type { EmailRenderer } from './application/ports/emailRenderer'
import type { EmailSender } from './application/ports/emailSender'
import {
  DeliverPendingEmailsUseCase,
  DEFAULT_DELIVER_OPTIONS,
  type DeliverPendingEmailsOptions,
} from './application/useCases/deliverPendingEmails'
import { EnqueueEmailUseCase } from './application/useCases/enqueueEmail'
import type { EmailConfig } from './infrastructure/config/emailConfig'
import { createLogEmailSender } from './infrastructure/log/logEmailSender'
import { createDrizzleEmailOutboxRepository } from './infrastructure/persistence/drizzleEmailOutboxRepository'
import {
  createResendClient,
  createResendEmailSender,
} from './infrastructure/resend/resendEmailSender'

// Único lugar que escolhe o transporte concreto a partir da configuração (`loadEmailConfig`).
export function createEmailSender(config: EmailConfig): EmailSender {
  if (config.provider === 'resend') {
    return createResendEmailSender({
      client: createResendClient(config.apiKey),
      from: config.from,
      replyTo: config.replyTo,
    })
  }
  return createLogEmailSender(config.from)
}

export interface NotificationsCompositionDeps {
  // O transporte (`createEmailSender`) e o renderer (templates, EM.1.3) entram de fora: quem liga
  // o worker (`server.ts`) decide, não este módulo.
  emailSender: EmailSender
  emailRenderer: EmailRenderer
  deliverOptions?: Partial<DeliverPendingEmailsOptions>
}

// Composição isolada de `createApp` (mesmo desenho de `payroll`/`ranking`): o envio é processo
// de fundo, não rota. `enqueueEmail` é o que os outros módulos recebem (por port própria de
// cada um); `deliverPendingEmails` é o que o scheduler executa.
export function createNotificationsComposition(db: Database, deps: NotificationsCompositionDeps) {
  const outbox = createDrizzleEmailOutboxRepository(db)
  const enqueueEmail = new EnqueueEmailUseCase(outbox)
  const deliverPendingEmails = new DeliverPendingEmailsUseCase(
    outbox,
    deps.emailRenderer,
    deps.emailSender,
    { ...DEFAULT_DELIVER_OPTIONS, ...deps.deliverOptions },
  )
  return { enqueueEmail, deliverPendingEmails }
}
