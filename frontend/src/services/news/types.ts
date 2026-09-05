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
    // Timestamp real de criação do evento (RFC 3339, tarefa 6.6.1) —
    // diferente de `triggered_on_day`, que é o dia **simulado**. Exibido
    // formatado no feed (5.1), mesmo padrão de `StatementList`/Extrato.
    created_at: string
    // Rastreio persistido por usuário (tarefa 6.6.2) — `true` se o usuário
    // autenticado já marcou este evento como visto (`POST /news/:id/seen`).
    // Diferente do sino da TopBar (NewsBell/useUnreadNews), que continua
    // client-side/agregado — os dois coexistem, propósitos diferentes.
    seen: boolean
}

export interface ListNewsResult {
    events: NewsEvent[]
    // Total de eventos macro sem paginação (tarefa 6.9.9) — sustenta
    // "Página X de Y" no Feed (5.1), que trocou "Carregar mais" por
    // paginação numerada (`useNewsFeedQuery`).
    total_entries: number
}
