export interface ReconciliationAudience {
  // Usuários com assinatura que vale reconferir: a projeção está velha (`updatedAt` antes de
  // `staleBefore`) e a vigência está ativa ou venceu há pouco (depois de `relevantSince`).
  // Assinatura vencida há muito tempo não entra: não há o que corrigir.
  findStale(params: { staleBefore: Date; relevantSince: Date; limit: number }): Promise<string[]>
}
