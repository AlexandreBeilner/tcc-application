import type { GetMarketCalendarUseCase } from '../../../market/application/useCases/getMarketCalendar'
import type { GetMarketClockUseCase } from '../../../market/application/useCases/getMarketClock'
import { businessDaysElapsed } from '../../domain/businessDay'
import { monthKeyOf } from '../../domain/monthKey'
import type { PayrollCalendarReader } from '../../application/ports/payrollCalendarReader'

function firstDayOfMonth(date: string): string {
  return `${date.slice(0, 7)}-01`
}

// Adapter em processo (mesmo padrão de
// `achievements/infrastructure/aggregation/inProcessProgressSnapshotReader.ts`)
// — chama os casos de uso já existentes de `modules/market` (S.10) em vez de
// falar HTTP com o motor de novo. `userId: ''` no `getMarketCalendar` é
// deliberado: o motor trata `user_id` ausente/vazio como "sem filtro de
// usuário" (`internal/infra/httpserver/calendar.go`, `handleGetMarketCalendar`)
// — o job de folha de pagamento só precisa do `weekday` global de cada dia,
// nunca de fatos de um usuário específico.
export function createInProcessPayrollCalendarReader(
  getMarketClock: GetMarketClockUseCase,
  getMarketCalendar: GetMarketCalendarUseCase,
): PayrollCalendarReader {
  return {
    async getCurrentMonthProgress() {
      const clock = await getMarketClock.execute()
      const calendar = await getMarketCalendar.execute({
        userId: '',
        from: firstDayOfMonth(clock.date),
        to: clock.date,
      })

      return {
        currentMonthKey: monthKeyOf(clock.date),
        businessDaysElapsedThisMonth: businessDaysElapsed(
          calendar.days.map((day) => ({ date: day.date, weekday: day.weekday })),
        ),
      }
    },
  }
}
