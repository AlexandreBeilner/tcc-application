import type { MarketClock } from '../../../services/market'
import { formatSelic, formatWeekdayDate } from '../calendarFormat'

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
