import type { Database } from '../../db/client'
import { GetProgressionUseCase } from '../gamification/application/useCases/getProgression'
import { createDrizzleProgressionRepository } from '../gamification/infrastructure/persistence/drizzleProgressionRepository'
import { GetMarketCalendarUseCase } from '../market/application/useCases/getMarketCalendar'
import { GetMarketClockUseCase } from '../market/application/useCases/getMarketClock'
import { createEngineMarketCalendarReader } from '../market/infrastructure/engine/engineMarketCalendarReader'
import { CreditMonthlyPayrollForUserUseCase } from './application/useCases/creditMonthlyPayrollForUser'
import { RunPayrollCheckUseCase } from './application/useCases/runPayrollCheck'
import { createEngineSalaryCrediter } from './infrastructure/engine/engineSalaryCrediter'
import { createInProcessLevelReader } from './infrastructure/gamification/inProcessLevelReader'
import { createInProcessPayrollCalendarReader } from './infrastructure/market/inProcessPayrollCalendarReader'
import { createDrizzlePayrollStateRepository } from './infrastructure/persistence/drizzlePayrollStateRepository'
import { createDrizzleUserDirectory } from './infrastructure/persistence/drizzleUserDirectory'

const DEFAULT_MAX_CATCHUP_MONTHS = 3

function positiveIntFromEnv(raw: string | undefined, fallback: number): number {
  const parsed = Number(raw || Number.NaN)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

// Composição isolada do resto de `createApp` (`app.ts`, T.5) — o job de
// folha de pagamento é processo de fundo, não rota HTTP; quem decide
// se/quando ligá-lo é `server.ts`. Reconstrói adapters leves de
// `gamification`/`market` que `app.ts` também constrói
// (progressionRepository, marketCalendarReader) — nenhum dos dois guarda
// estado próprio além de `db`/`engineUrl`, então duplicar a construção
// aqui é mais simples que replumbar `createApp` só pra exportar essas
// instâncias.
export function createPayrollComposition(db: Database, engineUrl: string) {
  const getProgression = new GetProgressionUseCase(createDrizzleProgressionRepository(db))
  const marketCalendarReader = createEngineMarketCalendarReader(engineUrl)
  const getMarketClock = new GetMarketClockUseCase(marketCalendarReader)
  const getMarketCalendar = new GetMarketCalendarUseCase(marketCalendarReader)

  const creditMonthlyPayrollForUser = new CreditMonthlyPayrollForUserUseCase(
    createInProcessLevelReader(getProgression),
    createDrizzlePayrollStateRepository(db),
    createEngineSalaryCrediter(engineUrl),
  )

  // Mesmo espírito de `TICK_MAX_CATCHUP` do motor (S.3) — teto de meses
  // recuperados de uma vez quando o backend ficou fora do ar.
  const maxCatchUpMonths = positiveIntFromEnv(
    process.env.PAYROLL_MAX_CATCHUP_MONTHS,
    DEFAULT_MAX_CATCHUP_MONTHS,
  )

  const runPayrollCheck = new RunPayrollCheckUseCase(
    createDrizzleUserDirectory(db),
    createInProcessPayrollCalendarReader(getMarketClock, getMarketCalendar),
    creditMonthlyPayrollForUser,
    maxCatchUpMonths,
  )

  return { runPayrollCheck }
}
