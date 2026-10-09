export type RankingScope = 'global' | 'friends'

// Tarefa 6.8.3 — 4 critérios de ordenação, não só rentabilidade geral.
// `level` é arquiteturalmente diferente dos outros 3 (não usa janela, não
// chama o motor nenhuma vez).
export type RankingCriterion = 'overall' | 'fixedIncome' | 'variableIncome' | 'level'

export type ProfitabilityCriterion = Exclude<RankingCriterion, 'level'>

export const PROFITABILITY_CRITERIA: ProfitabilityCriterion[] = [
  'overall',
  'fixedIncome',
  'variableIncome',
]

// Uma linha do ranking de um critério (já com o que a tela precisa).
export interface ScoredEntry {
  userId: string
  username: string
  level: number
  xp: number
  // `null` quando `criterion === 'level'` (rentabilidade não entra nesse critério).
  profitabilityPct: number | null
  // Chave de ordenação: `profitabilityPct` pros 3 primeiros critérios, `xp` pro `level`.
  sortKey: number
}

export function sortByRank(entries: ScoredEntry[]): ScoredEntry[] {
  return [...entries].sort((a, b) => b.sortKey - a.sortKey)
}
