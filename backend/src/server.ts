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
import {
  createBillingReconciliation,
  createFunnelRetentionPurge,
} from './modules/billing/composition'
import { startFunnelRetentionScheduler } from './modules/billing/infrastructure/scheduler/funnelRetentionScheduler'
import { loadBillingConfig } from './modules/billing/infrastructure/config/billingConfig'
import { startBillingReconciliationScheduler } from './modules/billing/infrastructure/scheduler/billingReconciliationScheduler'
import { createRedisClient } from './infra/redisClient'
import { assertProductionConfig } from './infra/productionConfigGuard'
import { createGracefulShutdown } from './infra/gracefulShutdown'
import { installJsonConsole } from './shared/logging/jsonConsole'
import { takeShutdownHooks } from './infra/shutdownRegistry'
import type { GenerateMonthlyRetrospectivesUseCase } from './modules/retrospectives/application/useCases/generateMonthlyRetrospectives'
import { startRetrospectiveScheduler } from './modules/retrospectives/infrastructure/scheduler/retrospectiveScheduler'
import { startDuelScheduler } from './modules/duels/infrastructure/scheduler/duelScheduler'
import type { SettleDueDuelsUseCase } from './modules/duels/application/useCases/settleDueDuels'
import type { RunAssemblyLifecycleUseCase } from './modules/assemblies/application/useCases/runAssemblyLifecycle'
import { startAssemblyScheduler } from './modules/assemblies/infrastructure/scheduler/assemblyScheduler'
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
// Retenção do funil de conversão (ponto 048): uma limpeza por dia basta.
const FUNNEL_RETENTION_INTERVAL_MS = 24 * 60 * 60 * 1000

// Cadência do ciclo das assembleias (MO.6.3): abrir, fechar e aplicar. Os prazos são de dias, então
// checar de hora em hora basta; tudo é idempotente.
const DEFAULT_ASSEMBLY_INTERVAL_MS = 60 * 60 * 1000

// Teto de espera pelas requisições em andamento no encerramento (LW.3.14). O `docker stop` dá 10 s
// antes do SIGKILL; 8 s deixa folga pra fechar o banco.
const SHUTDOWN_TIMEOUT_MS = 8000

async function main() {
  // Logs em JSON (uma linha por evento) em produção e staging; `LOG_FORMAT=json` no compose (LW.3.5).
  if (process.env.LOG_FORMAT === 'json') installJsonConsole()

  // LW.3.8: com DEPLOY_ENV=production, recusa subir com segredo/URL/provedor de desenvolvimento.
  // Vem antes de tudo, inclusive das migrações, pra uma configuração errada nunca tocar o banco.
  assertProductionConfig(process.env)

  // Configuração de e-mail (EM.1.2): valida na subida, pra uma chave faltando derrubar o
  // processo aqui e não na primeira requisição. O worker do outbox liga mais abaixo.
  const emailConfig = loadEmailConfig(process.env)
  console.log(`e-mail: provedor "${emailConfig.provider}" configurado`)

  const databaseUrl = process.env.DATABASE_URL
  if (databaseUrl) {
    // LW.3.17: em produção as migrações usam o papel dono do schema (DATABASE_MIGRATE_URL); o resto do
    // processo usa DATABASE_URL, um papel só com DML, que não consegue desligar o gatilho append-only.
    await runMigrations(process.env.DATABASE_MIGRATE_URL || databaseUrl)
    console.log('migrations do banco gamification aplicadas')
  }

  const db = createDb(databaseUrl ?? 'postgres://unconfigured')
  const userRepository = createDrizzleUserRepository(db)

  const webhook =
    emailConfig.provider === 'resend' && emailConfig.webhookSecret
      ? { apiKey: emailConfig.transactional.apiKey, secret: emailConfig.webhookSecret }
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
  const server = app.listen(port, () => {
    console.log(`backend gamificado escutando na porta ${port}`)
  })

  // Todo agendador devolve seu `setInterval`; o encerramento limpo (LW.3.14) os para antes de fechar o banco.
  const timers: NodeJS.Timeout[] = []
  const shutdown = createGracefulShutdown({
    server,
    timers: () => timers,
    resources: takeShutdownHooks,
    timeoutMs: SHUTDOWN_TIMEOUT_MS,
    exit: (code) => process.exit(code),
  })
  process.once('SIGTERM', () => void shutdown('SIGTERM'))
  process.once('SIGINT', () => void shutdown('SIGINT'))

  const engineUrl = process.env.ENGINE_URL ?? 'http://localhost:8080'
  const payrollCheckIntervalMs =
    Number(process.env.PAYROLL_CHECK_INTERVAL_MS || Number.NaN) || DEFAULT_PAYROLL_CHECK_INTERVAL_MS
  const { runPayrollCheck } = createPayrollComposition(db, engineUrl, enqueueEmail)
  timers.push(startPayrollScheduler(runPayrollCheck, payrollCheckIntervalMs))

  timers.push(
    startEmailOutboxScheduler(deliverPendingEmails, emailConfig.outboxIntervalMs, purgeOldEmails),
  )
  // O lembrete de sequência (EM.7.3) nasce ligado (ponto 045); `EMAIL_STREAK_REMINDER=off` desliga.
  timers.push(
    startEngagementScheduler(
      [
        { name: 'resumo semanal', execute: () => sendWeeklyDigest.execute() },
        ...(emailConfig.streakReminderEnabled
          ? [{ name: 'lembrete de sequência', execute: () => sendStreakReminders.execute() }]
          : []),
      ],
      emailConfig.engagementIntervalMs,
    ),
  )

  const rankingSnapshotIntervalMs =
    Number(process.env.RANKING_SNAPSHOT_INTERVAL_MS || Number.NaN) ||
    DEFAULT_RANKING_SNAPSHOT_INTERVAL_MS
  const { computeRankingSnapshot } = createRankingSnapshotComposition(db, engineUrl)
  timers.push(startRankingSnapshotScheduler(computeRankingSnapshot, rankingSnapshotIntervalMs))

  // Duelos (MO.5.3): encerra os vencidos, expira desafios sem resposta e credita o XP.
  timers.push(
    startDuelScheduler(
      app.locals.settleDueDuels as SettleDueDuelsUseCase,
      Number(process.env.DUEL_SETTLE_INTERVAL_MS || Number.NaN) || DEFAULT_DUEL_SETTLE_INTERVAL_MS,
    ),
  )

  // Retrospectivas (MO.5.4): gera e arquiva a do mês que acabou para quem ainda não tem.
  timers.push(
    startRetrospectiveScheduler(
      app.locals.generateMonthlyRetrospectives as GenerateMonthlyRetrospectivesUseCase,
      Number(process.env.RETROSPECTIVE_INTERVAL_MS || Number.NaN) ||
        DEFAULT_RETROSPECTIVE_INTERVAL_MS,
    ),
  )

  // Assembleia de Acionistas (MO.6.3): ligada por padrão; `ASSEMBLIES_ENABLED=off` desliga em
  // emergência (decisão do autor, 2026-10-11).
  const runAssemblyLifecycle = app.locals.runAssemblyLifecycle as
    RunAssemblyLifecycleUseCase | undefined
  if (runAssemblyLifecycle) {
    timers.push(
      startAssemblyScheduler(
        runAssemblyLifecycle,
        Number(process.env.ASSEMBLY_INTERVAL_MS || Number.NaN) || DEFAULT_ASSEMBLY_INTERVAL_MS,
      ),
    )
    console.log('assembleias: ciclo ligado')
  } else {
    console.log('assembleias: ciclo desligado (ASSEMBLIES_ENABLED=off)')
  }

  timers.push(
    startFunnelRetentionScheduler(createFunnelRetentionPurge(db), FUNNEL_RETENTION_INTERVAL_MS),
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
    timers.push(
      startBillingReconciliationScheduler(
        reconcileSubscriptions,
        Number(process.env.BILLING_RECONCILE_INTERVAL_MS || Number.NaN) ||
          DEFAULT_BILLING_RECONCILE_INTERVAL_MS,
      ),
    )
  }
}

main().catch((err) => {
  console.error('erro ao iniciar o backend gamificado:', err)
  process.exit(1)
})
