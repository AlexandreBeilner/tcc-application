import { createApp } from './app'
import { createDb } from './db/client'
import { runMigrations } from './db/migrate'
import { createDrizzleUserRepository } from './modules/auth/infrastructure/persistence/drizzleUserRepository'
import { createPayrollComposition } from './modules/payroll/composition'
import { startPayrollScheduler } from './modules/payroll/infrastructure/scheduler/payrollScheduler'

const port = Number(process.env.PORT) || 3000
// Cadência de checagem do job de folha de pagamento (T.5) — nunca precisa
// ser fina como o tick do motor (S.3): o pagamento em si só vence uma vez
// por mês-calendário real. 1h é o padrão; configurável só pra facilitar
// teste manual em `docker compose up`.
const DEFAULT_PAYROLL_CHECK_INTERVAL_MS = 60 * 60 * 1000

async function main() {
  const databaseUrl = process.env.DATABASE_URL
  if (databaseUrl) {
    await runMigrations(databaseUrl)
    console.log('migrations do banco gamification aplicadas')
  }

  const db = createDb(databaseUrl ?? 'postgres://unconfigured')
  const userRepository = createDrizzleUserRepository(db)

  createApp({ userRepository }).listen(port, () => {
    console.log(`backend gamificado escutando na porta ${port}`)
  })

  const engineUrl = process.env.ENGINE_URL ?? 'http://localhost:8080'
  const payrollCheckIntervalMs =
    Number(process.env.PAYROLL_CHECK_INTERVAL_MS || Number.NaN) || DEFAULT_PAYROLL_CHECK_INTERVAL_MS
  const { runPayrollCheck } = createPayrollComposition(db, engineUrl)
  startPayrollScheduler(runPayrollCheck, payrollCheckIntervalMs)
}

main().catch((err) => {
  console.error('erro ao iniciar o backend gamificado:', err)
  process.exit(1)
})
