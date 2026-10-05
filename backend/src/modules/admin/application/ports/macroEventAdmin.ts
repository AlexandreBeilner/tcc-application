import type { MacroEventResult } from './macroEventTrigger'

// Espelha GET/DELETE /macro-events/{id} do motor (tarefa N.11) — mesmos nomes de campo
// (snake_case), sem tradução.
export interface MacroEventImpactAsset {
  asset_id: string
  ticker: string
  price_before: number
  price_after: number
  change_pct: number
}

export interface MacroEventImpactTarget {
  sector?: string
  risk_class?: string
  asset_id?: string
  assets: MacroEventImpactAsset[]
  average_change_pct: number | null
}

// Variação de preço por alvo entre base_day (último dia antes do efeito) e end_day.
// `available` só é verdadeiro depois de o mercado chegar em end_day.
export interface MacroEventImpact {
  available: boolean
  window_days: number
  base_day: number
  end_day: number
  available_on_day: number
  targets: MacroEventImpactTarget[]
}

export interface MacroEventDetail extends MacroEventResult {
  created_by: string | null
  current_day: number
  // AAAA-MM-DD do dia do relatório de fundamentos; ausente se o evento não afeta fundamentos.
  report_date?: string
  // Se o usuário já enxerga o evento no feed e no calendário.
  publicly_visible: boolean
  impact: MacroEventImpact
}

// Ciclo de vida de um evento macro já disparado, no motor (macro_events vive no banco
// "market", dono é o motor).
export interface MacroEventAdmin {
  detail(eventId: string, windowDays?: number): Promise<MacroEventDetail>
  cancel(eventId: string): Promise<MacroEventResult>
}
