import type { ContentScope } from './content'
import { addDays } from './gameDay'

// Abaixo disto o painel avisa (DI.5.1): o conteúdo revisado e à frente está acabando.
export const LOW_REVIEWED_COVER_DAYS = 14

// Janela da contagem por categoria e marcador (seção 3.3).
export const COVERAGE_WINDOW_DAYS = 30

// Quantos dias seguidos, a partir de `from`, têm jogo com `ok` verdadeiro. Um buraco ou um dia
// ainda não revisado encerra a contagem: a estreia precisa de dias consecutivos, não de soma.
export function consecutiveDaysFrom(
  from: string,
  days: readonly { gameDate: string; ok: boolean }[],
): number {
  const byDate = new Map(days.map((d) => [d.gameDate, d.ok]))
  let count = 0
  while (byDate.get(addDays(from, count)) === true) count += 1
  return count
}

export interface CoverageTally {
  total: number
  brasil: number
  fora: number
  byCategory: Record<string, number>
}

export function emptyTally(): CoverageTally {
  return { total: 0, brasil: 0, fora: 0, byCategory: {} }
}

export function addToTally(
  tally: CoverageTally,
  item: { category: string; scope: ContentScope },
): void {
  tally.total += 1
  tally[item.scope] += 1
  tally.byCategory[item.category] = (tally.byCategory[item.category] ?? 0) + 1
}
