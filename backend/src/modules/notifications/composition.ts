import type { Database } from '../../db/client'
import type { EmailRenderer } from './application/ports/emailRenderer'
import type { EmailSender } from './application/ports/emailSender'
import {
  DeliverPendingEmailsUseCase,
  DEFAULT_DELIVER_OPTIONS,
  type DeliverPendingEmailsOptions,
} from './application/useCases/deliverPendingEmails'
import { EnqueueEmailUseCase } from './application/useCases/enqueueEmail'
import { createDrizzleEmailOutboxRepository } from './infrastructure/persistence/drizzleEmailOutboxRepository'

export interface NotificationsCompositionDeps {
  // O transporte e o renderer concretos entram aqui de fora: o `resend`/`log` (EM.1.2) e os
  // templates (EM.1.3) são decididos por quem liga o worker (`server.ts`), não por este módulo.
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
