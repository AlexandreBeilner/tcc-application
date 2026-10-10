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
import { createDrizzleEmailSuppressionRepository } from './infrastructure/persistence/drizzleEmailSuppressionRepository'
import { ReceiveProviderWebhookUseCase } from './application/useCases/receiveProviderWebhook'
import { createEmailWebhookRouter } from './interfaces/http/webhookRouter'
import {
  createResendWebhookParser,
  createResendWebhooks,
} from './infrastructure/resend/resendWebhookParser'
import {
  createResendClient,
  createResendEmailSender,
} from './infrastructure/resend/resendEmailSender'

// Nome mostrado no cabeçalho e no rodapé dos e-mails (o mesmo do `<title>` do frontend).
export const EMAIL_BRAND_NAME = 'Investimenta'

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
  // Credenciais do Resend pra verificar a assinatura do webhook (EM.1.4).
  webhook?: { apiKey: string; secret: string }
}

// Composição isolada de `createApp` (mesmo desenho de `payroll`/`ranking`): o envio é processo
// de fundo, não rota. `enqueueEmail` é o que os outros módulos recebem (por port própria de
// cada um); `deliverPendingEmails` é o que o scheduler executa.
export function createNotificationsComposition(db: Database, deps: NotificationsCompositionDeps) {
  const outbox = createDrizzleEmailOutboxRepository(db)
  const suppressions = createDrizzleEmailSuppressionRepository(db)
  const enqueueEmail = new EnqueueEmailUseCase(outbox, suppressions)
  const deliverPendingEmails = new DeliverPendingEmailsUseCase(
    outbox,
    suppressions,
    deps.emailRenderer,
    deps.emailSender,
    { ...DEFAULT_DELIVER_OPTIONS, ...deps.deliverOptions },
  )

  // O webhook só existe com o Resend e o segredo configurados (`createEmailWebhookRouter` é
  // montado em `app.ts` antes do `express.json()`); sem ele, `undefined` e a rota não existe.
  const emailWebhookRouter =
    deps.webhook &&
    createEmailWebhookRouter({
      receiveProviderWebhook: new ReceiveProviderWebhookUseCase(
        createResendWebhookParser({
          webhooks: createResendWebhooks(deps.webhook.apiKey),
          webhookSecret: deps.webhook.secret,
        }),
        outbox,
        suppressions,
      ),
    })

  return { enqueueEmail, deliverPendingEmails, emailWebhookRouter }
}
