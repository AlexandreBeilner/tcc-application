import type { TimelineEvent } from './cardAnswers'

export const TIMELINE_SIZE = 4

// xmur3 + mulberry32: PRNG pequeno e estável, semente vinda da data. Nunca
// `Math.random`: rodar de novo para o mesmo dia tem de dar o mesmo jogo.
function seedFrom(text: string): number {
  let h = 1779033703 ^ text.length
  for (let i = 0; i < text.length; i++) {
    h = Math.imul(h ^ text.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507)
  h = Math.imul(h ^ (h >>> 13), 3266489909)
  return (h ^ (h >>> 16)) >>> 0
}

function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

// Sorteia 4 fatos com anos distintos, em ordem de exibição embaralhada (nunca
// já na ordem certa). Devolve null se o banco não tem 4 anos distintos (a
// agenda, DI.1.3, trata como aviso, não como jogo quebrado). A ordem do banco
// recebido não influencia o resultado.
export function generateTimeline<T extends TimelineEvent>(
  date: string,
  bank: readonly T[],
): T[] | null {
  const random = mulberry32(seedFrom(`diario-timeline:${date}`))
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
