// Espelha o payload de `GET /market/indicators/history` do motor
// (`.docs/engine/tick.md`, tarefa M.2) campo a campo, em snake_case, sem
// tradução — mesma convenção de `catalogReader.ts` pro resto do módulo:
// este módulo é só o portão de autenticação na frente do motor, não dono
// do formato do dado.
export interface IndicatorHistoryEntry {
  simulated_day: number
  selic_rate: number
  ipca_monthly_rate: number
  ipca_accumulated_12m: number
}

// Lê a série histórica de Selic/IPCA do motor (tarefa M.3) — porta própria,
// não estendida de CatalogReader, porque indicadores macro não são um
// ativo do catálogo.
export interface IndicatorHistoryReader {
  getIndicatorHistory(days?: number): Promise<IndicatorHistoryEntry[]>
}
