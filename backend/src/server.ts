import { createApp } from './app'
import { createDb } from './db/client'
import { runMigrations } from './db/migrate'
import {
  createEmailSender,
  createNotificationsComposition,
  EMAIL_BRAND_NAME,
} from './modules/notifications/composition'
import { loadEmailLinksConfig } from './modules/notifications/infrastructure/config/emailLinksConfig'
import { loadEmailConfig } from './modules/notifications/infrastructure/config/emailConfig'
import { startEngagementScheduler } from './modules/notifications/infrastructure/scheduler/engagementScheduler'
import { startEmailOutboxScheduler } from './modules/notifications/infrastructure/scheduler/emailOutboxScheduler'
import { createHtmlEmailRenderer } from './modules/notifications/infrastructure/templates/htmlEmailRenderer'
import { createDrizzleUserRepository } from './modules/auth/infrastructure/persistence/drizzleUserRepository'
import { createRankingSnapshotComposition } from './modules/ranking/composition'
import { startRankingSnapshotScheduler } from './modules/ranking/infrastructure/scheduler/rankingSnapshotScheduler'
import { createBillingReconciliation } from './modules/billing/composition'
import { loadBillingConfig } from './modules/billing/infrastructure/config/billingConfig'
import { startBillingReconciliationScheduler } from './modules/billing/infrastructure/scheduler/billingReconciliationScheduler'
import { createRedisClient } from './infra/redisClient'
import type { GenerateMonthlyRetrospectivesUseCase } from './modules/retrospectives/application/useCases/generateMonthlyRetrospectives'
import { startRetrospectiveScheduler } from './modules/retrospectives/infrastructure/scheduler/retrospectiveScheduler'
import { startDuelScheduler } from './modules/duels/infrastructure/scheduler/duelScheduler'
import type { SettleDueDuelsUseCase } from './modules/duels/application/useCases/settleDueDuels'
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
// Cadência do job que encerra duelos vencidos e expira desafios (MO.5.3). O resultado é medido nos
// instantes de início e fim, então não importa a hora em que roda; 1h dá uma espera curta.
const DEFAULT_DUEL_SETTLE_INTERVAL_MS = 60 * 60 * 1000
// Cadência do job das retrospectivas mensais (MO.5.4): idempotente, então checar de hora em hora é barato.
const DEFAULT_RETROSPECTIVE_INTERVAL_MS = 60 * 60 * 1000
// Cadência da reconciliação de assinaturas (MO.2.5): rede de segurança do webhook, não precisa ser fina.
const DEFAULT_BILLING_RECONCILE_INTERVAL_MS = 6 * 60 * 60 * 1000

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
  const {
    enqueueEmail,
    deliverPendingEmails,
    purgeOldEmails,
    sendWeeklyDigest,
    sendStreakReminders,
    emailWebhookRouter,
  } = createNotificationsComposition(db, {
    emailSender: createEmailSender(emailConfig),
    emailRenderer: createHtmlEmailRenderer({
      brandName: EMAIL_BRAND_NAME,
      appUrl: process.env.FRONTEND_URL ?? 'http://localhost:5173',
    }),
    links: loadEmailLinksConfig(process.env),
    deliverOptions: { delayBetweenSendsMs: emailConfig.delayBetweenSendsMs },
    webhook,
  })

  const app = createApp({
    userRepository,
    emailWebhookRouter,
    enqueueEmail,
    emailSpacingMs: emailConfig.delayBetweenSendsMs,
  })
  app.listen(port, () => {
    console.log(`backend gamificado escutando na porta ${port}`)
  })

  const engineUrl = process.env.ENGINE_URL ?? 'http://localhost:8080'
  const payrollCheckIntervalMs =
    Number(process.env.PAYROLL_CHECK_INTERVAL_MS || Number.NaN) || DEFAULT_PAYROLL_CHECK_INTERVAL_MS
  const { runPayrollCheck } = createPayrollComposition(db, engineUrl, enqueueEmail)
  startPayrollScheduler(runPayrollCheck, payrollCheckIntervalMs)

  startEmailOutboxScheduler(deliverPendingEmails, emailConfig.outboxIntervalMs, purgeOldEmails)
  // O lembrete de sequência (EM.7.3) só liga com `EMAIL_STREAK_REMINDER=on`: o plano manda medir
  // cancelamento e reclamação do resumo semanal antes.
  startEngagementScheduler(
    [
      { name: 'resumo semanal', execute: () => sendWeeklyDigest.execute() },
      ...(emailConfig.streakReminderEnabled
        ? [{ name: 'lembrete de sequência', execute: () => sendStreakReminders.execute() }]
        : []),
    ],
    emailConfig.engagementIntervalMs,
  )

  const rankingSnapshotIntervalMs =
    Number(process.env.RANKING_SNAPSHOT_INTERVAL_MS || Number.NaN) ||
    DEFAULT_RANKING_SNAPSHOT_INTERVAL_MS
  const { computeRankingSnapshot } = createRankingSnapshotComposition(db, engineUrl)
  startRankingSnapshotScheduler(computeRankingSnapshot, rankingSnapshotIntervalMs)

  // Duelos (MO.5.3): encerra os vencidos, expira desafios sem resposta e credita o XP.
  startDuelScheduler(
    app.locals.settleDueDuels as SettleDueDuelsUseCase,
    Number(process.env.DUEL_SETTLE_INTERVAL_MS || Number.NaN) || DEFAULT_DUEL_SETTLE_INTERVAL_MS,
  )

  // Retrospectivas (MO.5.4): gera e arquiva a do mês que acabou para quem ainda não tem.
  startRetrospectiveScheduler(
    app.locals.generateMonthlyRetrospectives as GenerateMonthlyRetrospectivesUseCase,
    Number(process.env.RETROSPECTIVE_INTERVAL_MS || Number.NaN) ||
      DEFAULT_RETROSPECTIVE_INTERVAL_MS,
  )

  // Cobrança (MO.2.5): só reconcilia com o provedor ligado; desligado, não há nada pra reconsultar.
  const billingConfig = loadBillingConfig(process.env)
  console.log(`cobrança: provedor "${billingConfig.provider}" configurado`)
  if (billingConfig.provider === 'revenuecat') {
    const reconcileSubscriptions = createBillingReconciliation({
      db,
      redis: createRedisClient(process.env.REDIS_URL ?? 'redis://localhost:6379'),
      config: billingConfig,
      enqueueEmail,
    })
    startBillingReconciliationScheduler(
      reconcileSubscriptions,
      Number(process.env.BILLING_RECONCILE_INTERVAL_MS || Number.NaN) ||
        DEFAULT_BILLING_RECONCILE_INTERVAL_MS,
    )
  }
}

main().catch((err) => {
  console.error('erro ao iniciar o backend gamificado:', err)
  process.exit(1)
})
