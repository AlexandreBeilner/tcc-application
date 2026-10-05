export type AdminRankingWindow = 'week' | 'month'
export type AdminRankingCriterion = 'overall' | 'fixedIncome' | 'variableIncome' | 'level'

export interface AdminRankingEntry {
  position: number
  userId: string
  username: string
  level: number
  xp: number
  // Só rentabilidade percentual: nunca patrimônio absoluto (RNF09), nem no painel do ranking.
  profitabilityPct: number | null
}

export interface AdminRanking {
  window: AdminRankingWindow | null
  // Início e fim (inclusive) da janela corrente, em UTC; `null` no critério de nível (cumulativo).
  windowStart: Date | null
  windowEnd: Date | null
  criterion: AdminRankingCriterion
  entries: AdminRankingEntry[]
  page: number
  pageSize: number
  totalEntries: number
  totalPages: number
}

export interface AdminRankingQuery {
  window?: AdminRankingWindow
  criterion: AdminRankingCriterion
  page: number
}

// Leitura do ranking global pro painel (N.19). Somente leitura: o ranking é calculado na hora
// sobre a janela fixa (semana ou mês), não há janela gravada pra fechar nem recalcular.
export interface AdminRankingReader {
  read(query: AdminRankingQuery): Promise<AdminRanking>
}
