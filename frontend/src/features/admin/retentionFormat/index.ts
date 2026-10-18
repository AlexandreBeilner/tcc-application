import type { RetentionCell, RetentionMilestone, RetentionMilestoneSummary } from '../../../services/admin'

const rateFormatter = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const decimalFormatter = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 1 })

// Taxa de 0 a 1 em porcentagem com uma casa. Sem taxa, não há número para mostrar.
export function formatRetentionRate(rate: number | null): string {
    return rate === null ? 'sem dado' : `${rateFormatter.format(rate * 100)}%`
}

export type RetentionDayKey = 'd1' | 'd7' | 'd30'

// Faixas de cor da tabela de coortes. Referência de mercado para apps de uso recorrente, não meta do
// produto: a retenção cai com os dias, então a régua é diferente em cada coluna. Acima de `good` é
// verde, abaixo de `low` é vermelho, no meio é neutro. Ajustar aqui muda a tabela e a legenda.
export const RETENTION_BANDS: Record<RetentionDayKey, { good: number; low: number }> = {
    d1: { good: 0.4, low: 0.25 },
    d7: { good: 0.2, low: 0.12 },
    d30: { good: 0.1, low: 0.05 },
}

export type RetentionBand = 'good' | 'ok' | 'low'

export function retentionBand(day: RetentionDayKey, rate: number): RetentionBand {
    const band = RETENTION_BANDS[day]
    if (rate >= band.good) return 'good'
    return rate < band.low ? 'low' : 'ok'
}

// Texto da célula: a taxa quando houve medida e o motivo quando não houve. "Em andamento" e "sem
// dado" nunca viram 0%.
export function retentionCellText(cell: RetentionCell): string {
    if (cell.status === 'in_progress') return 'em andamento'
    if (cell.status === 'no_data') return 'sem dado'
    return formatRetentionRate(cell.rate)
}

const dayMonth = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' })

function utcDate(day: string): Date {
    return new Date(`${day}T00:00:00Z`)
}

export function formatDay(day: string): string {
    return dayMonth.format(utcDate(day))
}

// Semana de cadastro (segunda a domingo, UTC) como "12/10 a 18/10".
export function formatCohortWeek(weekStart: string): string {
    const end = new Date(utcDate(weekStart).getTime() + 6 * 86_400_000)
    return `${dayMonth.format(utcDate(weekStart))} a ${dayMonth.format(end)}`
}

export const MILESTONE_LABELS: Record<RetentionMilestone, string> = {
    first_return: 'Voltou depois do cadastro',
    first_lesson: 'Primeira lição concluída',
    first_trade: 'Primeira operação real',
    first_fixed_income: 'Primeira renda fixa',
    first_daily: 'Primeiro Diário',
}

const MINUTE = 60
const HOUR = 3600
const DAY = 86_400

// Mediana do tempo até o marco. O retorno só tem precisão de dia, então nunca vira horas.
export function formatMilestoneTime(item: Pick<RetentionMilestoneSummary, 'median_seconds' | 'granularity'>): string {
    const seconds = item.median_seconds
    if (seconds === null) return 'sem dado'
    if (item.granularity === 'day') {
        const days = Math.round(seconds / DAY)
        return days === 1 ? '1 dia' : `${days} dias`
    }
    if (seconds < HOUR) return `${Math.max(1, Math.round(seconds / MINUTE))} min`
    if (seconds < 2 * DAY) return `${decimalFormatter.format(seconds / HOUR)} h`
    return `${decimalFormatter.format(seconds / DAY)} dias`
}
