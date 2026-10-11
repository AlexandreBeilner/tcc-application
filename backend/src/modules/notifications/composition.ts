import type { Database } from '../../db/client'
import type { EmailRenderer } from './application/ports/emailRenderer'
import type { EmailSender } from './application/ports/emailSender'
import {
  DeliverPendingEmailsUseCase,
  DEFAULT_DELIVER_OPTIONS,
  type DeliverPendingEmailsOptions,
} from './application/useCases/deliverPendingEmails'
import { EnqueueEmailUseCase } from './application/useCases/enqueueEmail'
import { EraseEmailDataUseCase } from './application/useCases/eraseEmailData'
import { GetEmailPreferencesUseCase } from './application/useCases/getEmailPreferences'
import { SendStreakRemindersUseCase } from './application/useCases/sendStreakReminders'
import { createDrizzleStreakReminderAudience } from './infrastructure/persistence/drizzleStreakReminderAudience'
import { SendWeeklyDigestUseCase } from './application/useCases/sendWeeklyDigest'
import { createDrizzleWeeklyDigestAudience } from './infrastructure/persistence/drizzleWeeklyDigestAudience'
import { PurgeOldEmailsUseCase } from './application/useCases/purgeOldEmails'
import { UnsubscribeByTokenUseCase } from './application/useCases/unsubscribeByToken'
import { UpdateEmailPreferencesUseCase } from './application/useCases/updateEmailPreferences'
import type { EmailLinksConfig } from './infrastructure/config/emailLinksConfig'
import { createDrizzleEmailPreferencesRepository } from './infrastructure/persistence/drizzleEmailPreferencesRepository'
import { createDrizzleRecipientDirectory } from './infrastructure/persistence/drizzleRecipientDirectory'
import {
  createHmacUnsubscribeTokens,
  createUnsubscribeLinks,
} from './infrastructure/unsubscribe/hmacUnsubscribeTokens'
import type { AuthMiddleware } from '../../shared/http/authMiddleware'
import { createEmailPreferencesRouter } from './interfaces/http/preferencesRouter'
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
export const EMAIL_BRAND_NAME = 'Selucra'

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
  // Segredo e URLs dos links que os e-mails opcionais carregam (EM.6.1).
  links: EmailLinksConfig
  deliverOptions?: Partial<DeliverPendingEmailsOptions>
  // Credenciais do Resend pra verificar a assinatura do webhook (EM.1.4).
  webhook?: { apiKey: string; secret: string }
}

// Peças que o enfileiramento de e-mail opcional e as rotas de preferência compartilham. Os
// adapters são sem estado, então `server.ts` (worker) e `app.ts` (rotas) podem montar cada um o seu.
function createPreferenceParts(db: Database, links: EmailLinksConfig) {
  const preferences = createDrizzleEmailPreferencesRepository(db)
  const recipients = createDrizzleRecipientDirectory(db)
  const unsubscribeTokens = createHmacUnsubscribeTokens(links.unsubscribeSecret)
  const unsubscribeLinks = createUnsubscribeLinks(unsubscribeTokens, links.apiBaseUrl)
  return { preferences, recipients, unsubscribeTokens, unsubscribeLinks }
}

// `EnqueueEmailUseCase` completo (supressão, preferência, elegibilidade e link de cancelar).
export function createEnqueueEmailUseCase(db: Database, links: EmailLinksConfig) {
  const { preferences, recipients, unsubscribeLinks } = createPreferenceParts(db, links)
  return new EnqueueEmailUseCase(
    createDrizzleEmailOutboxRepository(db),
    createDrizzleEmailSuppressionRepository(db),
    { preferences, recipients, unsubscribeLinks },
  )
}

// Preferências de e-mail (EM.6.1): casos de uso, a rota pública/autenticada e o apagamento da
// exclusão de conta. Quem monta `app.ts` entrega o `authMiddleware`.
export function createEmailPreferencesComposition(
  db: Database,
  links: EmailLinksConfig,
  authMiddleware: AuthMiddleware,
) {
  const { preferences, recipients, unsubscribeTokens } = createPreferenceParts(db, links)
  const suppressions = createDrizzleEmailSuppressionRepository(db)
  const getEmailPreferences = new GetEmailPreferencesUseCase(preferences, recipients, suppressions)
  const eraseEmailData = new EraseEmailDataUseCase(
    createDrizzleEmailOutboxRepository(db),
    preferences,
  )
  const emailPreferencesRouter = createEmailPreferencesRouter({
    getEmailPreferences,
    updateEmailPreferences: new UpdateEmailPreferencesUseCase(preferences),
    unsubscribeByToken: new UnsubscribeByTokenUseCase(unsubscribeTokens, preferences),
    authMiddleware,
    unsubscribePageUrl: `${links.frontendUrl.replace(/\/+$/, '')}/cancelar-inscricao`,
  })
  return { getEmailPreferences, eraseEmailData, emailPreferencesRouter }
}

// Composição isolada de `createApp` (mesmo desenho de `payroll`/`ranking`): o envio é processo
// de fundo, não rota. `enqueueEmail` é o que os outros módulos recebem (por port própria de
// cada um); `deliverPendingEmails` é o que o scheduler executa.
export function createNotificationsComposition(db: Database, deps: NotificationsCompositionDeps) {
  const outbox = createDrizzleEmailOutboxRepository(db)
  const suppressions = createDrizzleEmailSuppressionRepository(db)
  const { preferences, recipients, unsubscribeLinks } = createPreferenceParts(db, deps.links)
  const enqueueEmail = new EnqueueEmailUseCase(outbox, suppressions, {
    preferences,
    recipients,
    unsubscribeLinks,
  })
  const deliverPendingEmails = new DeliverPendingEmailsUseCase(
    outbox,
    suppressions,
    preferences,
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

  const purgeOldEmails = new PurgeOldEmailsUseCase(outbox)
  const sendStreakReminders = new SendStreakRemindersUseCase(
    createDrizzleStreakReminderAudience(db),
    enqueueEmail,
  )
  // Jobs de engajamento (EM.7.x): só enfileiram, e só para quem ligou a categoria.
  const sendWeeklyDigest = new SendWeeklyDigestUseCase(
    createDrizzleWeeklyDigestAudience(db),
    enqueueEmail,
  )

  return {
    enqueueEmail,
    deliverPendingEmails,
    purgeOldEmails,
    sendWeeklyDigest,
    sendStreakReminders,
    emailWebhookRouter,
  }
}
