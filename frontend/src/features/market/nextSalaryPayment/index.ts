import type { CalendarDay } from '../../../services/market'

// Dias até o próximo `salary_payment` (T.9), a partir da mesma convenção do
// painel do calendário (`MarketCalendarPanel`): contagem em dias simulados, não
// data de calendário real. `days` já vem ordenado por `simulated_day` crescente
// (contrato de `GET /market/calendar`) — o primeiro dia >= hoje com um evento de
// salário futuro é sempre o mais próximo.
export function nextSalaryPaymentDays(days: CalendarDay[], todaySimulatedDay: number): number | null {
    const day = days.find(
        (candidate) =>
            candidate.simulated_day >= todaySimulatedDay &&
            candidate.events.some((event) => event.kind === 'salary_payment' && event.future),
    )
    return day ? day.simulated_day - todaySimulatedDay : null
}
