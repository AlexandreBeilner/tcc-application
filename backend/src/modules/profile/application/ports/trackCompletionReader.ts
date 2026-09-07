// Port própria e mínima sobre `modules/lessons` (backlog de engajamento
// F.2) — mesmo padrão de porta-por-consumidor já usado no resto do módulo
// (`achievementsReader`, `gamificationReader`, `profitabilityReader`).
// `listCompleted` espelha 1:1 `GetCompletedTracksUseCase` de `lessons` — o
// adapter em processo só repassa a chamada.
export interface TrackCompletionReader {
  listCompleted(userId: string): Promise<number[]>
}
