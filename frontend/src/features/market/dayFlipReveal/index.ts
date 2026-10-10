import type { MarketClock } from '../../../services/market'
import { formatCurrency } from '../../portfolio/format'
import { formatSelic, formatWeekdayDate } from '../calendarFormat'
import { monthLabel } from '../calendarEvents'

export interface DayFlipContent {
    title: string
    description: string
}

// Texto do toast dourado da virada de dia (teatro de recompensa leve, S.12).
// Mercado aberto: "Novo dia: Selic 10,5%" (a Selic vigente, se conhecida). Fim
// de semana: lembra que fechou e convida a estudar, nunca escassez.
export function describeDayFlip(clock: MarketClock, selicRate: number | null): DayFlipContent {
    if (!clock.market_open) {
        return { title: 'Novo dia: fim de semana', description: 'Mercado fechado até segunda. Hora de estudar.' }
    }
    const when = formatWeekdayDate(clock.weekday, clock.date)
    return {
        title: selicRate === null ? `Novo dia: dia ${clock.simulated_day}` : `Novo dia: Selic ${formatSelic(selicRate)}`,
        description: `${when}: mercado aberto`,
    }
}

// Texto do toast dedicado de salário (T.7): dispara ao lado do de virada de
// dia (fila do RewardRevealProvider), nunca no lugar dele, só quando o dia
// novo tem um salary_payment já pago do próprio usuário. `referenceMonth`
// (achado 025) só é passado quando o dia tem mais de um salary_payment (um
// catch-up de meses atrasados, backend T.5) — o título nomeia o mês pra
// distinguir os toasts da fila, que senão sairiam idênticos um atrás do
// outro; no caso comum (um só pagamento no dia) o título genérico é mantido.
export function describeSalaryReveal(amount: number, referenceMonth?: string): DayFlipContent {
    const title = referenceMonth ? `Salário de ${monthLabel(referenceMonth)}` : 'Salário do mês'
    return { title, description: `${formatCurrency(amount)} caiu na sua conta` }
}
