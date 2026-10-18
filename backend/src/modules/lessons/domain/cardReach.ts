import type { CatalogLesson } from './lessonCatalog'

// Funil por cartão (LJ.5.1). Posição = fase do player (0 Cenário, 1 Micro-decisão, 2 Revelação,
// 3 tela final) + índice do cartão dentro da fase. O índice é do player, que fatia o texto no
// cliente; o servidor só confere que cabe nos limites abaixo.
export const MAX_CARD_PHASE = 3
// Teto de sanidade (a maior lição tem 21 cartões): barra um cliente que reporta um índice absurdo
// e incharia a tabela e a tela do admin.
export const MAX_CARD_INDEX = 59

export const DEFAULT_FUNNEL_DAYS = 30
export const MAX_FUNNEL_DAYS = 365

export interface CardPosition {
  phase: number
  cardIndex: number
}

export function isValidCardPosition(position: CardPosition): boolean {
  return (
    Number.isInteger(position.phase) &&
    position.phase >= 0 &&
    position.phase <= MAX_CARD_PHASE &&
    Number.isInteger(position.cardIndex) &&
    position.cardIndex >= 0 &&
    position.cardIndex <= MAX_CARD_INDEX
  )
}

// `a` vem depois de `b` na lição (fase primeiro, depois cartão).
export function isBeyond(a: CardPosition, b: CardPosition): boolean {
  return a.phase > b.phase || (a.phase === b.phase && a.cardIndex > b.cardIndex)
}

// Dia UTC (`YYYY-MM-DD`), o mesmo critério dos outros agregados diários do backend.
export function reachDay(at: Date): string {
  return at.toISOString().slice(0, 10)
}

export interface CardReachRow extends CardPosition {
  reached: number
}

export interface CardFunnelBar extends CardPosition {
  reached: number
  // Quantos chegaram ao cartão anterior e não chegaram a este (0 no primeiro cartão).
  lost: number
  // `lost` sobre os que chegaram ao cartão anterior; `null` no primeiro cartão ou sem ninguém antes.
  lostRate: number | null
}

export interface CardFunnel {
  bars: CardFunnelBar[]
  // Cartão em que mais gente parou de chegar (em pessoas, não em %); `null` se ninguém caiu.
  biggestDrop: CardPosition | null
}

// Soma as linhas (uma por dia) por cartão, ordena na ordem da lição e mede a queda de cada cartão
// para o anterior. Uma queda nunca é negativa: quem retomou a lição no meio entra a partir de onde
// parou, então um cartão pode ter mais gente que o anterior.
export function buildCardFunnel(rows: CardReachRow[]): CardFunnel {
  const totals = new Map<string, CardReachRow>()
  for (const row of rows) {
    const key = `${row.phase}:${row.cardIndex}`
    const current = totals.get(key)
    totals.set(key, { ...row, reached: (current?.reached ?? 0) + row.reached })
  }
  const sorted = [...totals.values()].sort((a, b) => a.phase - b.phase || a.cardIndex - b.cardIndex)

  const bars: CardFunnelBar[] = []
  let biggestDrop: CardFunnelBar | null = null
  sorted.forEach((row, index) => {
    const previous = sorted[index - 1]
    const lost = previous ? Math.max(previous.reached - row.reached, 0) : 0
    const bar: CardFunnelBar = {
      phase: row.phase,
      cardIndex: row.cardIndex,
      reached: row.reached,
      lost,
      lostRate: previous && previous.reached > 0 ? lost / previous.reached : null,
    }
    bars.push(bar)
    if (lost > 0 && (!biggestDrop || lost > biggestDrop.lost)) {
      biggestDrop = bar
    }
  })

  const worst = biggestDrop as CardFunnelBar | null
  return {
    bars,
    biggestDrop: worst ? { phase: worst.phase, cardIndex: worst.cardIndex } : null,
  }
}

export interface LessonCardFunnel extends CardFunnel {
  lesson: Pick<CatalogLesson, 'id' | 'code' | 'title'>
  days: number
  // Primeiro dia (UTC) incluído na janela.
  since: string
}
