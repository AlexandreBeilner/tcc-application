import { describe, expect, it } from 'vitest'
import { buildAdminWorld } from '../../../test/adminWorld'
import { DailyAdminNotFoundError } from '../../../domain/errors'

const TODAY = '2026-10-20T12:00:00Z'
const START = '2026-11-10'

async function drafted() {
  const w = buildAdminWorld({ startDate: null, now: TODAY })
  await w.prepareDraft.execute(START)
  return w
}

describe('GetAdminPuzzleUseCase', () => {
  it('mostra qualquer dia futuro com o gabarito', async () => {
    const w = await drafted()
    const view = await w.getPuzzle.execute(20)
    expect(view.date).toBe('2026-11-29')
    expect(view.isTodayOrPast).toBe(false)
    expect(view.word.answer).toMatch(/^[A-Z]+$/)
    expect(view.question.correctIndex).toBeGreaterThanOrEqual(0)
    expect(view.origins).toEqual({ word: 'generated', question: 'generated' })
    expect(view.warnings).toEqual([])
  })

  it('jogo que não existe é 404', async () => {
    const w = await drafted()
    await expect(w.getPuzzle.execute(999)).rejects.toBeInstanceOf(DailyAdminNotFoundError)
  })
})

describe('PublishPuzzlesUseCase', () => {
  it('publica os informados, uma vez só', async () => {
    const w = await drafted()
    expect(await w.publishPuzzles.execute([2, 1])).toEqual({ published: [1, 2] })
    expect(await w.publishPuzzles.execute([1])).toEqual({ published: [] })
  })

  it('jogo que não existe é 404', async () => {
    const w = await drafted()
    await expect(w.publishPuzzles.execute([999])).rejects.toBeInstanceOf(DailyAdminNotFoundError)
  })

  it('sem números publica todos os que ainda não estão no ar', async () => {
    const w = await drafted()
    await w.publishPuzzles.execute([3, 5])
    const rest = await w.publishPuzzles.execute()
    expect(rest.published).toHaveLength(28)
    expect(rest.published).not.toContain(3)
    expect(w.puzzles.items.every((p) => p.publishedAt !== null)).toBe(true)
  })
})

describe('ReplacePuzzleCardUseCase', () => {
  it('troca a pergunta e marca como manual', async () => {
    const w = await drafted()
    const current = w.puzzles.items.find((p) => p.number === 1)!.questionId
    const other = w.questions.items.find((q) => q.id !== current)!
    await w.replaceCard.execute(1, { card: 'question', questionId: other.id }, false)
    const puzzle = w.puzzles.items.find((p) => p.number === 1)!
    expect(puzzle).toMatchObject({
      questionId: other.id,
      questionOrigin: 'manual',
      wordOrigin: 'generated',
    })
  })

  it('recusa item desativado ou inexistente', async () => {
    const w = await drafted()
    w.words.items[0].active = false
    await expect(
      w.replaceCard.execute(1, { card: 'word', wordId: w.words.items[0].id }, false),
    ).rejects.toMatchObject({ problems: ['a palavra está desativada'] })
    await expect(
      w.replaceCard.execute(1, { card: 'word', wordId: 'nada' }, false),
    ).rejects.toBeInstanceOf(DailyAdminNotFoundError)
  })

  it('jogo publicado só muda com confirmação explícita', async () => {
    const w = await drafted()
    await w.publishPuzzles.execute()
    const other = w.words.items[50]
    await expect(
      w.replaceCard.execute(1, { card: 'word', wordId: other.id }, false),
    ).rejects.toMatchObject({ code: 'confirmation_required' })

    await w.replaceCard.execute(1, { card: 'word', wordId: other.id }, true)
    const puzzle = w.puzzles.items.find((p) => p.number === 1)!
    expect(puzzle).toMatchObject({ wordId: other.id, wordOrigin: 'manual' })
    expect(puzzle.publishedAt).not.toBeNull()
  })
})
