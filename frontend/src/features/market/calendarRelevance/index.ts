import type { CalendarDay, CalendarEvent } from '../../../services/market'

export interface RelevantEntry {
    event: CalendarEvent
    day: CalendarDay
}

export interface CalendarRelevanceSummary {
    mineCount: number
    marketCount: number
    // Soma dos proventos do usuário ainda por vir, em R$. Estimativa enquanto
    // algum deles ainda não tem data-ex passada.
    upcomingPayout: number
    upcomingPayoutIsEstimate: boolean
}

export interface RelevantCalendar {
    mine: RelevantEntry[]
    market: RelevantEntry[]
    summary: CalendarRelevanceSummary
}

function compareEntries(a: RelevantEntry, b: RelevantEntry): number {
    return a.day.simulated_day - b.day.simulated_day
}

// Separa os fatos da janela entre "Para você" (`mine`) e "No mercado" (`market`),
// em ordem cronológica (estável dentro do dia, a ordem do motor). Os contadores
// vêm do `summary` do motor quando existe, porque ele conta antes do corte por
// `market_limit`; sem ele, contam o que veio.
export function calendarRelevance(days: CalendarDay[]): RelevantCalendar {
    const mine: RelevantEntry[] = []
    const market: RelevantEntry[] = []
    let mineCount = 0
    let marketCount = 0
    let upcomingPayout = 0
    let upcomingPayoutIsEstimate = false

    for (const day of days) {
        mineCount += day.summary?.mine_count ?? day.events.filter((event) => event.relevance === 'mine').length
        marketCount += day.summary?.market_count ?? day.events.filter((event) => event.relevance !== 'mine').length
        for (const event of day.events) {
            if (event.relevance !== 'mine') {
                market.push({ event, day })
                continue
            }
            mine.push({ event, day })
            if (event.future && event.estimated_amount !== undefined) {
                upcomingPayout += event.estimated_amount
                upcomingPayoutIsEstimate ||= event.amount_is_estimate === true
            }
        }
    }

    return {
        mine: mine.sort(compareEntries),
        market: market.sort(compareEntries),
        summary: { mineCount, marketCount, upcomingPayout, upcomingPayoutIsEstimate },
    }
}
