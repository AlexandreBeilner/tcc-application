import { shiftIsoDate } from '../calendarFormat'
import { nextSalaryPaymentDays } from '../nextSalaryPayment'
import { useMarketCalendarQuery } from '../useMarketCalendarQuery'
import { useMarketClockQuery } from '../useMarketClockQuery'

// Salário cai no 5º dia útil do mês (T.4), então em cenário ruim (pagamento
// recém-caído no início do mês) o próximo pode estar a ~35 dias simulados de
// distância — a janela fica com folga sobre isso, ainda bem abaixo do limite
// de 92 dias de `GET /market/calendar`.
const DAYS_AHEAD = 40

// `undefined` = carregando (relógio ou calendário ainda não resolveram),
// `null` = nenhum pagamento futuro na janela (não deveria acontecer em uso
// normal), número = dias simulados até o próximo `salary_payment` (T.9).
export function useNextSalaryPayment(): number | null | undefined {
    const clockQuery = useMarketClockQuery()
    const clock = clockQuery.data

    const calendarQuery = useMarketCalendarQuery(
        clock?.date ?? null,
        clock ? shiftIsoDate(clock.date, DAYS_AHEAD) : null,
        clock !== undefined,
    )

    if (!clock || !calendarQuery.data) return undefined
    return nextSalaryPaymentDays(calendarQuery.data.days, clock.simulated_day)
}
