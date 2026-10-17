import type { TimelineEvent } from './cardAnswers'
import { seededRandom, shuffle } from './seededRandom'

export const TIMELINE_SIZE = 4

// Sorteia 4 fatos com anos distintos, em ordem de exibição embaralhada (nunca
// já na ordem certa). Devolve null se o banco não tem 4 anos distintos (a
// agenda, DI.1.3, trata como aviso, não como jogo quebrado). A ordem do banco
// recebido não influencia o resultado.
export function generateTimeline<T extends TimelineEvent>(
  date: string,
  bank: readonly T[],
): T[] | null {
  const random = seededRandom(`diario-timeline:${date}`)
  const pool = shuffle(
    [...bank].sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0)),
    random,
  )

  const picked: T[] = []
  const years = new Set<number>()
  for (const event of pool) {
    if (years.has(event.year)) continue
    years.add(event.year)
    picked.push(event)
    if (picked.length === TIMELINE_SIZE) break
  }
  if (picked.length < TIMELINE_SIZE) return null

  const display = shuffle(picked, random)
  const chronological = [...display].sort((x, y) => x.year - y.year)
  if (display.every((event, i) => event === chronological[i])) {
    ;[display[0], display[1]] = [display[1], display[0]]
  }
  return display
}
