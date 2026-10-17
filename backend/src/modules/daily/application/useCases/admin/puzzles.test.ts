import { describe, expect, it } from 'vitest'
import { ADMIN, buildAdminWorld, reviewAll } from '../../../test/adminWorld'
import { DailyAdminNotFoundError } from '../../../domain/errors'

const TODAY = '2026-10-20T12:00:00Z'
const START = '2026-11-10'

async function drafted() {
  const w = buildAdminWorld({ startDate: null, now: TODAY })
  await w.prepareDraft.execute(START)
  return w
}

describe('GetAdminPuzzleUseCase', () => {
  it('mostra qualquer dia futuro com o gabarito e a ordem certa da Linha do tempo', async () => {
    const w = await drafted()
    const view = await w.getPuzzle.execute(20)
    expect(view.date).toBe('2026-11-29')
    expect(view.isTodayOrPast).toBe(false)
    expect(view.word.answer).toMatch(/^[A-Z]+$/)
    expect(view.question.correctIndex).toBeGreaterThanOrEqual(0)
    const years = view.correctOrder.map((id) => view.events.find((e) => e.id === id)!.year)
    expect(years).toEqual([...years].sort((a, b) => a - b))
    expect(view.warnings).toContain('há pergunta ou evento deste dia ainda sem revisão')
  })

  it('jogo que não existe é 404', async () => {
    const w = await drafted()
    await expect(w.getPuzzle.execute(999)).rejects.toBeInstanceOf(DailyAdminNotFoundError)
  })
})

describe('ReviewPuzzleUseCase', () => {
  it('marca o dia e os itens dele como revisados', async () => {
    const w = await drafted()
    await w.reviewPuzzle.execute(ADMIN, 1)
    const puzzle = w.puzzles.items.find((p) => p.number === 1)!
    expect(puzzle.reviewedAt).not.toBeNull()
    const question = w.questions.items.find((q) => q.id === puzzle.questionId)!
    expect(question.reviewedAt).not.toBeNull()
    for (const id of puzzle.timelineEventIds) {
      expect(w.events.items.find((e) => e.id === id)!.reviewedAt).not.toBeNull()
    }
  })

  it('recusa revisar dia com item desativado', async () => {
    const w = await drafted()
    const puzzle = w.puzzles.items.find((p) => p.number === 1)!
    w.questions.items.find((q) => q.id === puzzle.questionId)!.active = false
    await expect(w.reviewPuzzle.execute(ADMIN, 1)).rejects.toMatchObject({
      problems: ['a pergunta do dia está desativada'],
    })
  })
})

describe('PublishPuzzlesUseCase', () => {
  it('recusa publicar dia sem revisão', async () => {
    const w = await drafted()
    await expect(w.publishPuzzles.execute([1])).rejects.toMatchObject({ code: 'not_reviewed' })
  })

  it('publica os informados, uma vez só', async () => {
    const w = await drafted()
    await w.reviewPuzzle.execute(ADMIN, 1)
    await w.reviewPuzzle.execute(ADMIN, 2)
    expect(await w.publishPuzzles.execute([2, 1])).toEqual({ published: [1, 2] })
    expect(await w.publishPuzzles.execute([1])).toEqual({ published: [] })
  })

  it('sem números publica todos os revisados e só eles', async () => {
    const w = await drafted()
    await w.reviewPuzzle.execute(ADMIN, 3)
    await w.reviewPuzzle.execute(ADMIN, 5)
    expect(await w.publishPuzzles.execute()).toEqual({ published: [3, 5] })
    expect(w.puzzles.items.filter((p) => p.publishedAt !== null)).toHaveLength(2)
  })
})

describe('ReplacePuzzleCardUseCase', () => {
  it('troca a pergunta, marca como manual e zera a revisão do dia', async () => {
    const w = await drafted()
    await w.reviewPuzzle.execute(ADMIN, 1)
    const current = w.puzzles.items.find((p) => p.number === 1)!.questionId
    const other = w.questions.items.find((q) => q.id !== current)!
    await w.replaceCard.execute(ADMIN, 1, { card: 'question', questionId: other.id }, false)
    const puzzle = w.puzzles.items.find((p) => p.number === 1)!
    expect(puzzle).toMatchObject({
      questionId: other.id,
      questionOrigin: 'manual',
      wordOrigin: 'generated',
      reviewedAt: null,
    })
  })

  it('a Linha do tempo exige 4 eventos de anos distintos e nunca fica na ordem certa', async () => {
    const w = await drafted()
    await expect(
      w.replaceCard.execute(ADMIN, 1, { card: 'timeline', eventIds: ['e1', 'e2', 'e3'] }, false),
    ).rejects.toMatchObject({ problems: ['a Linha do tempo precisa de 4 eventos'] })

    w.events.items.find((e) => e.id === 'e4')!.year = w.events.items.find(
      (e) => e.id === 'e3',
    )!.year
    await expect(
      w.replaceCard.execute(
        ADMIN,
        1,
        { card: 'timeline', eventIds: ['e1', 'e2', 'e3', 'e4'] },
        false,
      ),
    ).rejects.toMatchObject({ problems: ['os eventos precisam ter anos distintos'] })

    await w.replaceCard.execute(
      ADMIN,
      1,
      { card: 'timeline', eventIds: ['e10', 'e11', 'e12', 'e13'] },
      false,
    )
    const puzzle = w.puzzles.items.find((p) => p.number === 1)!
    expect([...puzzle.timelineEventIds].sort()).toEqual(['e10', 'e11', 'e12', 'e13'])
    expect(puzzle.timelineEventIds).not.toEqual(['e10', 'e11', 'e12', 'e13'])
    expect(puzzle.timelineOrigin).toBe('manual')
  })

  it('recusa item desativado ou inexistente', async () => {
    const w = await drafted()
    w.words.items[0].active = false
    await expect(
      w.replaceCard.execute(ADMIN, 1, { card: 'word', wordId: w.words.items[0].id }, false),
    ).rejects.toMatchObject({ problems: ['a palavra está desativada'] })
    await expect(
      w.replaceCard.execute(ADMIN, 1, { card: 'word', wordId: 'nada' }, false),
    ).rejects.toBeInstanceOf(DailyAdminNotFoundError)
  })

  it('jogo publicado só muda com confirmação explícita, e a edição vale como revisão', async () => {
    const w = await drafted()
    await reviewAll(w)
    await w.publishPuzzles.execute()
    const other = w.words.items[50]
    await expect(
      w.replaceCard.execute(ADMIN, 1, { card: 'word', wordId: other.id }, false),
    ).rejects.toMatchObject({ code: 'confirmation_required' })

    await w.replaceCard.execute(ADMIN, 1, { card: 'word', wordId: other.id }, true)
    const puzzle = w.puzzles.items.find((p) => p.number === 1)!
    expect(puzzle).toMatchObject({ wordId: other.id, wordOrigin: 'manual' })
    expect(puzzle.publishedAt).not.toBeNull()
    expect(puzzle.reviewedAt).not.toBeNull()
  })
})
