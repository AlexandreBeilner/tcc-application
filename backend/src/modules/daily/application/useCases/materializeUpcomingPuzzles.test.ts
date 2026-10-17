import { describe, expect, it } from 'vitest'
import type { DailyFact, DailyPuzzle, DailyWord } from '../../domain/content'
import {
  createFakeDailyFactRepository,
  createFakeDailyPuzzleRepository,
  createFakeDailySettingsRepository,
  createFakeDailyWordRepository,
} from '../../test/fakes/fakeDailyRepositories'
import { MaterializeUpcomingPuzzlesUseCase } from './materializeUpcomingPuzzles'

const word = (i: number, scope: 'brasil' | 'fora' = 'brasil'): DailyWord => ({
  id: `w${i}`,
  stableKey: `w${i}`,
  answer: `PALA${String.fromCharCode(65 + (i % 26))}${String.fromCharCode(65 + Math.floor(i / 26))}`,
  display: 'x',
  definition: 'd',
  learnMore: null,
  category: `cat${i % 5}`,
  scope,
  active: true,
})

const fact = (i: number): DailyFact => ({
  id: `f${i}`,
  stableKey: `f${i}`,
  eventDate: `${1900 + i}-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 27) + 1).padStart(2, '0')}`,
  question: 'q',
  options: ['a', 'b'],
  correctIndex: 0,
  explanation: 'e',
  timelineLabel: `evento ${i}`,
  sourceRef: 'BCB',
  learnMore: null,
  category: `cat${i % 4}`,
  scope: 'brasil',
  reviewedAt: null,
  active: true,
})

const manyWords = (n: number) => Array.from({ length: n }, (_, i) => word(i))
const manyFacts = (n: number) => Array.from({ length: n }, (_, i) => fact(i))

function setup(opts: {
  start: string | null
  now: string
  words?: DailyWord[]
  facts?: DailyFact[]
  puzzles?: DailyPuzzle[]
  horizon?: number
}) {
  const settings = createFakeDailySettingsRepository(opts.start)
  const words = createFakeDailyWordRepository(opts.words ?? manyWords(60))
  const facts = createFakeDailyFactRepository(opts.facts ?? manyFacts(200))
  const puzzles = createFakeDailyPuzzleRepository(opts.puzzles)
  const useCase = new MaterializeUpcomingPuzzlesUseCase(
    settings,
    words,
    facts,
    puzzles,
    () => new Date(opts.now),
    {
      horizonDays: opts.horizon ?? 30,
    },
  )
  return { settings, words, facts, puzzles, useCase }
}

const puzzleAt = (
  number: number,
  gameDate: string,
  over: Partial<DailyPuzzle> = {},
): DailyPuzzle => ({
  number,
  gameDate,
  wordId: `w${number + 100}`,
  factId: `f${number + 100}`,
  timelineFactIds: ['f1', 'f2', 'f3', 'f4'],
  wordOrigin: 'generated',
  factOrigin: 'generated',
  timelineOrigin: 'generated',
  reviewedBy: null,
  reviewedAt: null,
  publishedAt: null,
  ...over,
})

describe('MaterializeUpcomingPuzzlesUseCase', () => {
  it('desligado: não materializa nada', async () => {
    const { useCase, puzzles } = setup({ start: null, now: '2026-11-01T12:00:00Z' })
    expect(await useCase.execute()).toMatchObject({ status: 'off', created: [] })
    expect(puzzles.items).toHaveLength(0)
  })

  it('agendado: materializa 30 dias a partir da estreia, #1 na data da estreia', async () => {
    const { useCase, puzzles } = setup({ start: '2026-11-10', now: '2026-11-01T12:00:00Z' })
    const result = await useCase.execute()
    expect(result.status).toBe('scheduled')
    expect(result.created).toEqual(Array.from({ length: 30 }, (_, i) => i + 1))
    expect(puzzles.items[0]).toMatchObject({
      number: 1,
      gameDate: '2026-11-10',
      reviewedAt: null,
      publishedAt: null,
    })
    expect(puzzles.items.at(-1)).toMatchObject({ number: 30, gameDate: '2026-12-09' })
    expect(result.warnings.filter((w) => w.code !== 'on_this_day_not_exact')).toEqual([])
  })

  it('no ar: materializa a partir de hoje, com a numeração da estreia', async () => {
    const { useCase, puzzles } = setup({
      start: '2026-11-01',
      now: '2026-11-11T12:00:00Z',
      horizon: 5,
    })
    const result = await useCase.execute()
    expect(result.status).toBe('live')
    expect(result.created).toEqual([11, 12, 13, 14, 15])
    expect(puzzles.items[0].gameDate).toBe('2026-11-11')
  })

  it('o dia de hoje segue a virada UTC (21h de Brasília)', async () => {
    const before = setup({ start: '2026-11-01', now: '2026-11-10T23:59:00Z', horizon: 1 })
    expect((await before.useCase.execute()).created).toEqual([10])
    const after = setup({ start: '2026-11-01', now: '2026-11-11T00:00:00Z', horizon: 1 })
    expect((await after.useCase.execute()).created).toEqual([11])
  })

  it('é idempotente: rodar de novo não cria nem altera nada', async () => {
    const { useCase, puzzles } = setup({ start: '2026-11-10', now: '2026-11-01T12:00:00Z' })
    await useCase.execute()
    const snapshot = JSON.stringify(puzzles.items)
    const again = await useCase.execute()
    expect(again.created).toEqual([])
    expect(JSON.stringify(puzzles.items)).toBe(snapshot)
  })

  it('ao longo da agenda, palavra e fato do dia não repetem', async () => {
    const { useCase, puzzles } = setup({ start: '2026-11-10', now: '2026-11-01T12:00:00Z' })
    await useCase.execute()
    expect(new Set(puzzles.items.map((p) => p.wordId)).size).toBe(30)
    expect(new Set(puzzles.items.map((p) => p.factId)).size).toBe(30)
  })

  it('a regra de variedade vale na agenda inteira: nunca a mesma categoria em dias seguidos', async () => {
    const { useCase, puzzles, words } = setup({ start: '2026-11-10', now: '2026-11-01T12:00:00Z' })
    await useCase.execute()
    const category = (id: string) => words.items.find((w) => w.id === id)!.category
    for (let i = 1; i < puzzles.items.length; i++) {
      expect(category(puzzles.items[i].wordId)).not.toBe(category(puzzles.items[i - 1].wordId))
    }
  })

  it('banco insuficiente: avisa o dia e não grava jogo quebrado', async () => {
    const { useCase, puzzles } = setup({
      start: '2026-11-10',
      now: '2026-11-01T12:00:00Z',
      words: manyWords(3),
    })
    const result = await useCase.execute()
    expect(puzzles.items).toHaveLength(3)
    const missing = result.warnings.filter((w) => w.code === 'no_word_available')
    expect(missing).toHaveLength(27)
    expect(missing[0].date).toBe('2026-11-13')
  })

  it('banco vazio: só avisos', async () => {
    const { useCase, puzzles } = setup({
      start: '2026-11-10',
      now: '2026-11-01T12:00:00Z',
      words: [],
      facts: [],
      horizon: 2,
    })
    const result = await useCase.execute()
    expect(puzzles.items).toHaveLength(0)
    expect(result.warnings.map((w) => w.code)).toEqual([
      'no_word_available',
      'no_fact_available',
      'no_timeline_available',
      'no_word_available',
      'no_fact_available',
      'no_timeline_available',
    ])
  })

  it('jogo publicado e jogo já existente ficam intocados', async () => {
    const published = puzzleAt(1, '2026-11-10', {
      publishedAt: new Date('2026-11-05T00:00:00Z'),
      wordOrigin: 'manual',
    })
    const reviewed = puzzleAt(2, '2026-11-11', {
      reviewedBy: 'admin',
      reviewedAt: new Date('2026-11-06T00:00:00Z'),
    })
    const { useCase, puzzles } = setup({
      start: '2026-11-10',
      now: '2026-11-01T12:00:00Z',
      puzzles: [published, reviewed],
      horizon: 5,
    })
    const result = await useCase.execute()
    expect(result.created).toEqual([3, 4, 5])
    expect(puzzles.items.find((p) => p.number === 1)).toEqual(published)
    expect(puzzles.items.find((p) => p.number === 2)).toEqual(reviewed)
  })

  describe('mudança da data de estreia enquanto agendado', () => {
    it('adiar: renumera os não publicados e mantém a revisão', async () => {
      // Agenda feita para estreia em 10/11; a estreia agora é 12/11.
      const reviewed = puzzleAt(3, '2026-11-12', {
        reviewedBy: 'admin',
        reviewedAt: new Date('2026-11-06T00:00:00Z'),
      })
      const { useCase, puzzles } = setup({
        start: '2026-11-12',
        now: '2026-11-01T12:00:00Z',
        puzzles: [
          puzzleAt(1, '2026-11-10'),
          puzzleAt(2, '2026-11-11'),
          reviewed,
          puzzleAt(4, '2026-11-13'),
        ],
        horizon: 4,
      })
      const result = await useCase.execute()
      expect(result).toMatchObject({ removed: 2, renumbered: 2, created: [3, 4] })
      expect(puzzles.items.map((p) => [p.number, p.gameDate])).toEqual([
        [1, '2026-11-12'],
        [2, '2026-11-13'],
        [3, '2026-11-14'],
        [4, '2026-11-15'],
      ])
      expect(puzzles.items[0]).toMatchObject({ reviewedBy: 'admin', wordId: reviewed.wordId })
    })

    it('antecipar: renumera e completa o começo da agenda', async () => {
      const { useCase, puzzles } = setup({
        start: '2026-11-08',
        now: '2026-11-01T12:00:00Z',
        puzzles: [
          puzzleAt(1, '2026-11-10', {
            reviewedBy: 'admin',
            reviewedAt: new Date('2026-11-06T00:00:00Z'),
          }),
        ],
        horizon: 4,
      })
      const result = await useCase.execute()
      expect(result.renumbered).toBe(1)
      expect(result.created).toEqual([1, 2, 4])
      expect(puzzles.items.find((p) => p.gameDate === '2026-11-10')).toMatchObject({
        number: 3,
        reviewedBy: 'admin',
      })
    })

    it('jogo publicado desalinhado não é mexido, só avisado', async () => {
      const published = puzzleAt(1, '2026-11-10', { publishedAt: new Date('2026-11-05T00:00:00Z') })
      const { useCase, puzzles } = setup({
        start: '2026-11-12',
        now: '2026-11-01T12:00:00Z',
        puzzles: [published],
        horizon: 1,
      })
      const result = await useCase.execute()
      expect(result.warnings).toContainEqual({ date: '2026-11-10', code: 'published_misaligned' })
      expect(puzzles.items).toContainEqual(published)
    })
  })

  it('usa o fato de um jogo antigo já desativado na janela de repetição', async () => {
    const facts = manyFacts(200)
    const past = puzzleAt(1, '2026-11-01', {
      factId: 'f77',
      wordId: 'w5',
      publishedAt: new Date('2026-11-01T00:00:00Z'),
    })
    const {
      useCase,
      puzzles,
      facts: factRepo,
    } = setup({
      start: '2026-11-01',
      now: '2026-11-02T12:00:00Z',
      facts,
      puzzles: [past],
      horizon: 5,
    })
    factRepo.items.find((f) => f.id === 'f77')!.active = false
    await useCase.execute()
    expect(puzzles.items.slice(1).every((p) => p.factId !== 'f77' && p.wordId !== 'w5')).toBe(true)
  })
})
