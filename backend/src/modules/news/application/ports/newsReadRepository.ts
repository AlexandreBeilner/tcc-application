// Persistência de "visto" por usuário (tarefa 6.6.2) — tabela própria do
// módulo (`news_event_reads`), diferente de `NewsFeedReader` (que só lê o
// catálogo de eventos do motor). macroEventId é um uuid do banco "market"
// (dono é o motor), sem FK real — mesmo raciocínio de accounts/positions.
export interface NewsReadRepository {
  // Recebe os ids da página atual (não a tabela inteira) — evita carregar
  // todo o histórico de leitura do usuário a cada GET /news.
  listSeenEventIds(userId: string, macroEventIds: string[]): Promise<Set<string>>

  // Idempotente: reenviar o mesmo par (userId, macroEventId) não duplica
  // linha nem lança erro (mesmo padrão de POST /missions/:id/complete).
  markAsSeen(userId: string, macroEventId: string): Promise<void>
}
