import type { MarketClock } from '../../../services/market'
import { shiftIsoDate } from '../calendarFormat'

export interface QuarterCell {
    simulatedDay: number
    date: string
    weekday: string
    open: boolean
    // Dia de relatório trimestral: o último do trimestre.
    isReportDay: boolean
}

const WEEKDAY_CODES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

// Os 91 dias do trimestre corrente derivados só do relógio (sem esperar o
// calendário carregar): a grade do desktop nasce desenhada e os fatos entram
// por cima. `quarter_day` é 1-based, então o primeiro dia é `date - (quarter_day - 1)`.
export function quarterCells(clock: MarketClock): QuarterCell[] {
    const firstDay = clock.simulated_day - (clock.quarter_day - 1)
    const firstDate = shiftIsoDate(clock.date, -(clock.quarter_day - 1))
    return Array.from({ length: clock.quarter_length }, (_, index) => {
        const date = shiftIsoDate(firstDate, index)
        const weekday = WEEKDAY_CODES[new Date(`${date}T00:00:00Z`).getUTCDay()]
        return {
            simulatedDay: firstDay + index,
            date,
            weekday,
            open: weekday !== 'sat' && weekday !== 'sun',
            isReportDay: index === clock.quarter_length - 1,
        }
    })
}
