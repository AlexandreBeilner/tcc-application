import type { MacroEventResult } from './macroEventTrigger'

// Espelha a paginação simples de GET /macro-events do motor de simulação
// (tarefa 4.5) — limit/offset opcionais, motor aplica o default (20,
// máximo 100) quando ausentes; o backend só repassa o que recebeu na
// query string.
export interface ListMacroEventsQuery {
  limit?: number
  offset?: number
}

export interface ListMacroEventsResult {
  events: MacroEventResult[]
}

// Lê o histórico de eventos macro do motor de simulação — macro_events
// vive no banco "market", dono é o motor, nunca lido direto por aqui
// (mesmo raciocínio de MacroEventTrigger).
export interface MacroEventReader {
  list(query: ListMacroEventsQuery): Promise<ListMacroEventsResult>
}
