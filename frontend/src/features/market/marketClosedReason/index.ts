import type { MarketClock } from '../../../services/market'

const WEEKDAY_LABEL: Record<string, string> = {
    sun: 'domingo',
    mon: 'segunda',
    tue: 'terça',
    wed: 'quarta',
    thu: 'quinta',
    fri: 'sexta',
    sat: 'sábado',
}

const MS_PER_HOUR = 3_600_000
const MS_PER_DAY = 24 * MS_PER_HOUR

// Instante real em que o mercado reabre: cada dia simulado dura 24h / fator,
// então a reabertura é o próximo tick mais (dias faltantes - 1) intervalos.
// `null` sem agenda automática (sem `next_tick_at`, não há como estimar).
function reopensAt(clock: MarketClock): Date | null {
    if (!clock.next_tick_at) return null
    const interval = MS_PER_DAY / clock.days_per_real_day
    return new Date(new Date(clock.next_tick_at).getTime() + (clock.days_until_open - 1) * interval)
}

function formatDuration(ms: number): string {
    const totalMinutes = Math.max(1, Math.ceil(ms / 60_000))
    const hours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60
    if (hours === 0) return `${minutes}min`
    return `${hours}h${String(minutes).padStart(2, '0')}`
}

// "12/01" a partir de "2026-01-12", sem passar por Date (evita fuso).
function formatDayMonth(isoDate: string): string {
    const [, month, day] = isoDate.split('-')
    return `${day}/${month}`
}

// Data de calendário da reabertura: `date` do relógio mais os dias faltantes.
function reopeningDate(clock: MarketClock): string {
    const date = new Date(`${clock.date}T00:00:00Z`)
    date.setUTCDate(date.getUTCDate() + clock.days_until_open)
    return date.toISOString().slice(0, 10)
}

// Motivo em texto pro botão de ordem/aporte desabilitado (tarefa S.11), nunca só
// cor: "Mercado fechado: fim de semana simulado. Abre em 4h12, segunda 12/01".
// `null` com o mercado aberto. Sandbox nunca chama isto (segue aberto).
export function describeMarketClosed(clock: MarketClock, now: Date = new Date()): string | null {
    if (clock.market_open) return null

    const opensOn = reopeningDate(clock)
    const opensDate = new Date(`${opensOn}T00:00:00Z`)
    const weekday = WEEKDAY_LABEL[['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][opensDate.getUTCDay()]]
    const when = `${weekday} ${formatDayMonth(opensOn)}`

    const at = reopensAt(clock)
    if (!at) return `Mercado fechado: fim de semana simulado. Abre ${when}`
    return `Mercado fechado: fim de semana simulado. Abre em ${formatDuration(at.getTime() - now.getTime())}, ${when}`
}
