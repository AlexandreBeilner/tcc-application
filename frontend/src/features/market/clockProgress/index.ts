import type { MarketClock } from '../../../services/market'

const MS_PER_DAY = 24 * 3_600_000

// Duração real de um dia simulado: 24h / fator (fator 5 = 4h48).
export function simulatedDayDurationMs(clock: Pick<MarketClock, 'days_per_real_day'>): number {
    return MS_PER_DAY / clock.days_per_real_day
}

// Posição do ponteiro do relógio dentro do dia simulado corrente (0 a 1): quanto
// do intervalo até o próximo tick já passou. `null` sem `next_tick_at` (agenda
// automática desligada): o ponteiro fica parado e o texto "próximo dia em" some.
export function clockProgress(clock: MarketClock, now: Date): number | null {
    if (!clock.next_tick_at) return null
    const remaining = new Date(clock.next_tick_at).getTime() - now.getTime()
    const progress = 1 - remaining / simulatedDayDurationMs(clock)
    return Math.min(1, Math.max(0, progress))
}
