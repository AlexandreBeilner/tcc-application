import type { DailyResult } from '../../domain/content'
import { newResult } from '../../domain/resultState'
import type { DailyResultRepository } from '../../application/ports/dailyResultRepository'
import type { StreakTouchResult, StreakTracker } from '../../application/ports/streakTracker'
import type { XpAwardResult, XpAwarder } from '../../application/ports/xpAwarder'
import type { AcceptedWordRepository } from '../../application/ports/acceptedWordRepository'
import type { DailyEvent, DailyPuzzle, DailyQuestion, DailyWord } from '../../domain/content'
import type { DailyEventRepository } from '../../application/ports/dailyEventRepository'
import type { DailyPuzzleRepository } from '../../application/ports/dailyPuzzleRepository'
import type { DailyQuestionRepository } from '../../application/ports/dailyQuestionRepository'
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

export function createFakeDailyQuestionRepository(
  initial: DailyQuestion[] = [],
): DailyQuestionRepository & { items: DailyQuestion[] } {
  const items = [...initial]
  return {
    items,
    async create(item) {
      const created = { ...item, id: `q${items.length + 1}` }
      items.push(created)
      return created
    },
    async findById(id) {
      return items.find((x) => x.id === id) ?? null
    },
    async findManyByIds(ids) {
      return items.filter((x) => ids.includes(x.id))
    },
    async listActive() {
      return items.filter((x) => x.active)
    },
  }
}

export function createFakeDailyEventRepository(
  initial: DailyEvent[] = [],
): DailyEventRepository & { items: DailyEvent[] } {
  const items = [...initial]
  return {
    items,
    async create(item) {
      const created = { ...item, id: `e${items.length + 1}` }
      items.push(created)
      return created
    },
    async findById(id) {
      return items.find((x) => x.id === id) ?? null
    },
    async findManyByIds(ids) {
      return items.filter((x) => ids.includes(x.id))
    },
    async listActive() {
      return items.filter((x) => x.active)
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

export function createFakeAcceptedWordRepository(
  initial: string[] = [],
): AcceptedWordRepository & { words: Set<string> } {
  const words = new Set(initial)
  return {
    words,
    async isAccepted(word) {
      return words.has(word)
    },
    async addMany(list) {
      let added = 0
      for (const w of list) {
        if (!words.has(w)) {
          words.add(w)
          added += 1
        }
      }
      return added
    },
  }
}

export interface FakeDailyResultRepository extends DailyResultRepository {
  items: DailyResult[]
}

export function createFakeDailyResultRepository(
  initial: DailyResult[] = [],
): FakeDailyResultRepository {
  const items = [...initial]
  const index = (userId: string, n: number) =>
    items.findIndex((r) => r.userId === userId && r.puzzleNumber === n)
  return {
    items,
    async find(userId, n) {
      return items[index(userId, n)] ?? null
    },
    async save(result) {
      const i = index(result.userId, result.puzzleNumber)
      if (i >= 0) items[i] = result
      else items.push(result)
    },
    async listByUser(userId) {
      return items
        .filter((r) => r.userId === userId)
        .sort((a, b) => a.puzzleNumber - b.puzzleNumber)
    },
    // Como o repositório real, `apply` que lança não grava nada. O JS é de thread única e `apply`
    // é síncrono, então não há intercalação a simular aqui; a trava de linha é testada no banco.
    async update(userId, n, now, apply) {
      const current = items[index(userId, n)] ?? newResult(userId, n, now)
      const { next, value } = apply(current)
      const i = index(userId, n)
      if (i >= 0) items[i] = next
      else items.push(next)
      return { result: next, value }
    },
  }
}

export interface FakeXpAwarder extends XpAwarder {
  awarded: { userId: string; amount: number; reason: string }[]
  nextResult: XpAwardResult
}

export function createFakeXpAwarder(
  nextResult: XpAwardResult = { xp: 0, level: 1, leveledUp: false, unlockedAchievements: [] },
): FakeXpAwarder {
  const awarded: FakeXpAwarder['awarded'] = []
  const fake: FakeXpAwarder = {
    awarded,
    nextResult,
    async award(userId, amount, reason) {
      awarded.push({ userId, amount, reason })
      return fake.nextResult
    },
  }
  return fake
}

export interface FakeStreakTracker extends StreakTracker {
  touchedUserIds: string[]
  nextResult: StreakTouchResult
}

export function createFakeStreakTracker(
  nextResult: StreakTouchResult = {
    currentStreak: 1,
    longestStreak: 1,
    milestoneReached: null,
    unlockedAchievements: [],
  },
): FakeStreakTracker {
  const touchedUserIds: string[] = []
  const fake: FakeStreakTracker = {
    touchedUserIds,
    nextResult,
    async touch(userId) {
      touchedUserIds.push(userId)
      return fake.nextResult
    },
  }
  return fake
}
