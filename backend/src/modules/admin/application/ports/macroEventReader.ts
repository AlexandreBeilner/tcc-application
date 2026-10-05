import type { MacroEventResult } from './macroEventTrigger'

// Espelha a paginação simples de GET /macro-events do motor de simulação
// (tarefa 4.5) — limit/offset opcionais, motor aplica o default (20,
// máximo 100) quando ausentes; o backend só repassa o que recebeu na
// query string.
//
// Tarefa N.11: `view` escolhe quem lê (o motor assume `public` quando ausente, a visão
// do feed do usuário, sem cancelado nem agendado antes da véspera); o painel passa
// `admin`, a única que enxerga tudo. Os demais campos são os filtros do histórico do
// painel (no máximo um filtro de alvo; período em dias simulados do primeiro dia de efeito).
export type MacroEventView = 'public' | 'admin'
export type MacroEventStatus = 'pendente' | 'aplicado' | 'cancelado'

export interface ListMacroEventsQuery {
  limit?: number
  offset?: number
  view?: MacroEventView
  status?: MacroEventStatus
  sector?: string
  risk_class?: string
  asset_id?: string
  from_day?: number
  to_day?: number
}

export interface ListMacroEventsResult {
  events: MacroEventResult[]
  // Total de eventos macro (sem paginação) — motor devolve desde a tarefa
  // 6.9.9, sustenta "Página X de Y" no feed (5.1) sem trocar o contrato de
  // limit/offset já usado por GET /admin/macro-events (10.1) e GET /news.
  total_entries: number
}

// Lê o histórico de eventos macro do motor de simulação — macro_events
// vive no banco "market", dono é o motor, nunca lido direto por aqui
// (mesmo raciocínio de MacroEventTrigger).
export interface MacroEventReader {
  list(query: ListMacroEventsQuery): Promise<ListMacroEventsResult>
}
