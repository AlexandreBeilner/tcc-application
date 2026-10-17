import type { DailyFact, DailyPuzzle, DailyWord } from '../../domain/content'
import type { DailyFactRepository } from '../../application/ports/dailyFactRepository'
import type { DailyPuzzleRepository } from '../../application/ports/dailyPuzzleRepository'
import type { DailySettingsRepository } from '../../application/ports/dailySettingsRepository'
import type { DailyWordRepository } from '../../application/ports/dailyWordRepository'

export interface FakeDailySettingsRepository extends DailySettingsRepository {
  state: { startDate: string | null }
}

export function createFakeDailySettingsRepository(
  startDate: string | null = null,
): FakeDailySettingsRepository {
  const state = { startDate }
  return {
    state,
    async get() {
      return { startDate: state.startDate, updatedBy: null, updatedAt: new Date(0) }
    },
    async setStartDate(next) {
      state.startDate = next
    },
  }
}

export function createFakeDailyWordRepository(
  initial: DailyWord[] = [],
): DailyWordRepository & { items: DailyWord[] } {
  const items = [...initial]
  return {
    items,
    async create(word) {
      const created = { ...word, id: `w${items.length + 1}` }
      items.push(created)
      return created
    },
    async findById(id) {
      return items.find((w) => w.id === id) ?? null
    },
    async listActive() {
      return items.filter((w) => w.active)
    },
  }
}

export function createFakeDailyFactRepository(
  initial: DailyFact[] = [],
): DailyFactRepository & { items: DailyFact[] } {
  const items = [...initial]
  return {
    items,
    async create(fact) {
      const created = { ...fact, id: `f${items.length + 1}` }
      items.push(created)
      return created
    },
    async findById(id) {
      return items.find((f) => f.id === id) ?? null
    },
    async findManyByIds(ids) {
      return items.filter((f) => ids.includes(f.id))
    },
    async listActive() {
      return items.filter((f) => f.active)
    },
  }
}

export interface FakeDailyPuzzleRepository extends DailyPuzzleRepository {
  items: DailyPuzzle[]
}

export function createFakeDailyPuzzleRepository(
  initial: DailyPuzzle[] = [],
): FakeDailyPuzzleRepository {
  const items = [...initial]
  const sorted = () => [...items].sort((a, b) => (a.gameDate < b.gameDate ? -1 : 1))
  return {
    items,
    async create(puzzle) {
      if (items.some((p) => p.number === puzzle.number || p.gameDate === puzzle.gameDate)) {
        throw new Error('jogo repetido')
      }
      items.push(puzzle)
    },
    async findByNumber(number) {
      return items.find((p) => p.number === number) ?? null
    },
    async findByDate(gameDate) {
      return items.find((p) => p.gameDate === gameDate) ?? null
    },
    async listFromDate(fromDate, limit) {
      return sorted()
        .filter((p) => p.gameDate >= fromDate)
        .slice(0, limit)
    },
    async markReviewed(number, reviewedBy, now) {
      const p = items.find((x) => x.number === number)
      if (p) Object.assign(p, { reviewedBy, reviewedAt: now })
    },
    async markPublished(number, now) {
      const p = items.find((x) => x.number === number)
      if (p) p.publishedAt = now
    },
    async replaceUnpublished(puzzles) {
      const published = items.filter((p) => p.publishedAt !== null)
      items.splice(0, items.length, ...published, ...puzzles)
    },
  }
}
