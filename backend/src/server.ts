import { createApp } from './app'
import { createDb } from './db/client'
import { runMigrations } from './db/migrate'
import {
  createEmailSender,
  createNotificationsComposition,
  EMAIL_BRAND_NAME,
} from './modules/notifications/composition'
import { loadEmailConfig } from './modules/notifications/infrastructure/config/emailConfig'
import { startEmailOutboxScheduler } from './modules/notifications/infrastructure/scheduler/emailOutboxScheduler'
import { createHtmlEmailRenderer } from './modules/notifications/infrastructure/templates/htmlEmailRenderer'
import { createDrizzleUserRepository } from './modules/auth/infrastructure/persistence/drizzleUserRepository'
import { createRankingSnapshotComposition } from './modules/ranking/composition'
import { startRankingSnapshotScheduler } from './modules/ranking/infrastructure/scheduler/rankingSnapshotScheduler'
import { createPayrollComposition } from './modules/payroll/composition'
import { startPayrollScheduler } from './modules/payroll/infrastructure/scheduler/payrollScheduler'

const port = Number(process.env.PORT) || 3000
// Cadência de checagem do job de folha de pagamento (T.5) — nunca precisa
// ser fina como o tick do motor (S.3): o pagamento em si só vence uma vez
// por mês-calendário real. 1h é o padrão; configurável só pra facilitar
// teste manual em `docker compose up`.
const DEFAULT_PAYROLL_CHECK_INTERVAL_MS = 60 * 60 * 1000
// Cadência do job que recalcula o ranking (3h). A tela lê o snapshot, nunca recalcula.
const DEFAULT_RANKING_SNAPSHOT_INTERVAL_MS = 3 * 60 * 60 * 1000

async function main() {
  // Configuração de e-mail (EM.1.2): valida na subida, pra uma chave faltando derrubar o
  // processo aqui e não na primeira requisição. O worker do outbox liga mais abaixo.
  const emailConfig = loadEmailConfig(process.env)
  console.log(`e-mail: provedor "${emailConfig.provider}" configurado`)

  const databaseUrl = process.env.DATABASE_URL
  if (databaseUrl) {
    await runMigrations(databaseUrl)
    console.log('migrations do banco gamification aplicadas')
  }

  const db = createDb(databaseUrl ?? 'postgres://unconfigured')
  const userRepository = createDrizzleUserRepository(db)

  const webhook =
    emailConfig.provider === 'resend' && emailConfig.webhookSecret
      ? { apiKey: emailConfig.apiKey, secret: emailConfig.webhookSecret }
      : undefined
  if (emailConfig.provider === 'resend' && !webhook) {
    console.warn(
      'e-mail: RESEND_WEBHOOK_SECRET ausente. Bounces e reclamações não serão processados e a lista de supressão não se alimenta: configure antes de enviar para usuários reais.',
    )
  }
  const { enqueueEmail, deliverPendingEmails, emailWebhookRouter } = createNotificationsComposition(
    db,
    {
      emailSender: createEmailSender(emailConfig),
      emailRenderer: createHtmlEmailRenderer({
        brandName: EMAIL_BRAND_NAME,
        appUrl: process.env.FRONTEND_URL ?? 'http://localhost:5173',
      }),
      deliverOptions: { delayBetweenSendsMs: emailConfig.delayBetweenSendsMs },
      webhook,
    },
  )

  createApp({
    userRepository,
    emailWebhookRouter,
    enqueueEmail,
    emailSpacingMs: emailConfig.delayBetweenSendsMs,
  }).listen(port, () => {
    console.log(`backend gamificado escutando na porta ${port}`)
  })

  const engineUrl = process.env.ENGINE_URL ?? 'http://localhost:8080'
  const payrollCheckIntervalMs =
    Number(process.env.PAYROLL_CHECK_INTERVAL_MS || Number.NaN) || DEFAULT_PAYROLL_CHECK_INTERVAL_MS
  const { runPayrollCheck } = createPayrollComposition(db, engineUrl)
  startPayrollScheduler(runPayrollCheck, payrollCheckIntervalMs)

  startEmailOutboxScheduler(deliverPendingEmails, emailConfig.outboxIntervalMs)

  const rankingSnapshotIntervalMs =
    Number(process.env.RANKING_SNAPSHOT_INTERVAL_MS || Number.NaN) ||
    DEFAULT_RANKING_SNAPSHOT_INTERVAL_MS
  const { computeRankingSnapshot } = createRankingSnapshotComposition(db, engineUrl)
  startRankingSnapshotScheduler(computeRankingSnapshot, rankingSnapshotIntervalMs)
}

main().catch((err) => {
  console.error('erro ao iniciar o backend gamificado:', err)
  process.exit(1)
})
