// Alvo de um evento macro — exatamente um entre os três campos preenchido
// (`macroevent.NewTarget`, motor). Setor e classe de risco são escopos
// (potencialmente vários ativos), sem tela de listagem filtrada por nenhum
// dos dois hoje — só exibidos como texto. `asset_id` é o único caso com
// link real (resolvido via `GET /market/assets`, mesmo padrão de
// `StatementList`/Extrato).
export interface NewsEventTarget {
    sector?: string
    risk_class?: string
    asset_id?: string
}

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
    targets: NewsEventTarget[]
}

export interface ListNewsResult {
    events: NewsEvent[]
}
