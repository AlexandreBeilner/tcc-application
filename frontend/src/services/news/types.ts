// Espelha `.docs/backend/news.md` (`GET /news`) — mesmo formato de item de
// `GET /admin/macro-events` (`.docs/engine/macroevent.md`), sem tradução de
// campo (`narrative` já é a versão amigável).
export interface NewsEvent {
    id: string
    template_key?: string
    title: string
    narrative: string
    direction: 'positivo' | 'negativo' | 'misto'
    magnitude_band: 'leve' | 'moderado' | 'severo'
    affects_price: boolean
    affects_fundamentals: boolean
    status: 'pendente' | 'aplicado'
    triggered_on_day: number
    duration_days: number
    price_effect_pct?: number
    fundamentals_effect_pct?: number
    fundamentals_report_day?: number
}

export interface ListNewsResult {
    events: NewsEvent[]
}
