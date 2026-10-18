// Port própria e mínima sobre `modules/lessons` (backlog de engajamento
// F.2) — mesmo padrão de porta-por-consumidor já usado no resto do módulo
// (`achievementsReader`, `gamificationReader`, `profitabilityReader`).
// `listCompleted` espelha 1:1 `GetCompletedTracksUseCase` de `lessons` — o
// adapter em processo só repassa a chamada.
export interface TrackCompletionReader {
  listCompleted(userId: string): Promise<number[]>
  // Códigos das lições concluídas (LJ.5.9, coleção de termos): o catálogo de termos vive no frontend, que cruza
  // estes códigos com a lição que ensina cada termo. Só estudo, nenhum dado financeiro.
  listCompletedLessonCodes(userId: string): Promise<string[]>
}
