import { describe, expect, it } from 'vitest'
import { LessonLockedError, LessonNotFoundError } from '../../domain/errors'
import { createFakeLessonPollRepository } from '../../test/fakes/fakeLessonPollRepository'
import { createFakeLessonRepository } from '../../test/fakes/fakeLessonRepository'
import { GetLessonUseCase } from './getLesson'
import type { LessonSummary } from '../../domain/lesson'

const lessons = [1, 2].map((n) => ({
  id: `l${n}`,
  code: `0.${n}`,
  title: `Lição 0.${n}`,
  trackNumber: 0,
  trackName: 'Trilha 0: Fundamentos',
  sortOrder: n,
  centralConcept: 'x',
  scenarioText: '',
  microDecisionPrompt: '',
  microDecisionType: 'reflection' as const,
  microDecisionAssetTicker: null,
  revelationText: '',
  unlocksDescription: null,
  unlocksKeys: [],
  unlocksAssetTicker: null,
  microDecisionOptions: null,
  microDecisionCorrectOption: null,
}))

describe('GetLessonUseCase', () => {
  it('rejeita id inexistente com LessonNotFoundError (404 no router)', async () => {
    const repository = createFakeLessonRepository(lessons)
    const useCase = new GetLessonUseCase(repository, createFakeLessonPollRepository())

    await expect(useCase.execute({ userId: 'u1', lessonId: 'nope' })).rejects.toBeInstanceOf(
      LessonNotFoundError,
    )
  })

  it('rejeita lição ainda bloqueada com LessonLockedError (404 no router)', async () => {
    const repository = createFakeLessonRepository(lessons)
    const useCase = new GetLessonUseCase(repository, createFakeLessonPollRepository())

    await expect(useCase.execute({ userId: 'u1', lessonId: 'l2' })).rejects.toBeInstanceOf(
      LessonLockedError,
    )
  })

  it('retorna a lição disponível com progresso pra retomar', async () => {
    const repository = createFakeLessonRepository(lessons)
    await repository.upsertProgress('u1', 'l1', { currentStep: 2, completedAt: null })
    const useCase = new GetLessonUseCase(repository, createFakeLessonPollRepository())

    const result = await useCase.execute({ userId: 'u1', lessonId: 'l1' })

    expect(result.status).toBe('available')
    expect(result.currentStep).toBe(2)
  })
})

describe('GetLessonUseCase: Relembra? (LJ.5.5)', () => {
  const withCheck = (n: number, track = 0): LessonSummary => ({
    ...lessons[0],
    id: `r${n}`,
    code: `${track}.${n}`,
    title: `Lição r${n}`,
    sortOrder: n,
    trackNumber: track,
    blocks: {
      schemaVersion: 1,
      phases: {
        scenario: [
          {
            type: 'check',
            id: `q${n}`,
            kind: 'single',
            prompt: `pergunta ${n}`,
            options: ['a', 'b'],
            answer: 1,
            explanation: 'segredo',
          },
        ],
        microDecision: [],
        revelation: [],
      },
    },
  })
  const track = [1, 2, 3, 4].map((n) => withCheck(n))
  const day = new Date('2026-10-18T10:00:00Z')

  async function build() {
    const repository = createFakeLessonRepository(track)
    const useCase = new GetLessonUseCase(repository, createFakeLessonPollRepository(), () => day)
    return { repository, useCase }
  }

  it('a primeira lição da trilha não traz pergunta', async () => {
    const { useCase } = await build()
    const result = await useCase.execute({ userId: 'u1', lessonId: 'r1' })
    expect(result.recall).toBeUndefined()
  })

  it('a segunda traz uma pergunta da lição concluída, sem gabarito', async () => {
    const { repository, useCase } = await build()
    await repository.upsertProgress('u1', 'r1', { currentStep: 3, completedAt: day })

    const result = await useCase.execute({ userId: 'u1', lessonId: 'r2' })

    expect(result.recall).toMatchObject({ lessonId: 'r1', lessonTitle: 'Lição r1' })
    expect(result.recall?.block).toMatchObject({ id: 'q1', kind: 'single' })
    expect(JSON.stringify(result.recall)).not.toContain('segredo')
  })

  it('prefere a pergunta que a pessoa errou', async () => {
    const { repository, useCase } = await build()
    for (const id of ['r1', 'r2']) {
      await repository.upsertProgress('u1', id, { currentStep: 3, completedAt: day })
    }
    await repository.recordCheckpointAnswer('u1', 'r1', 'q1', {
      choice: 0,
      correct: false,
      answeredAt: day,
    })
    await repository.recordCheckpointAnswer('u1', 'r1', 'q1', {
      choice: 1,
      correct: true,
      answeredAt: day,
    })
    await repository.recordCheckpointAnswer('u1', 'r2', 'q2', {
      choice: 1,
      correct: true,
      answeredAt: day,
    })

    const result = await useCase.execute({ userId: 'u1', lessonId: 'r3' })

    expect(result.recall?.block.id).toBe('q1')
  })

  it('recarregar no mesmo dia não troca a pergunta', async () => {
    const { repository, useCase } = await build()
    for (const id of ['r1', 'r2', 'r3']) {
      await repository.upsertProgress('u1', id, { currentStep: 3, completedAt: day })
    }
    const first = await useCase.execute({ userId: 'u1', lessonId: 'r4' })
    const second = await useCase.execute({ userId: 'u1', lessonId: 'r4' })
    expect(second.recall).toEqual(first.recall)
  })

  it('lição concluída (revisão) e lição retomada no meio não trazem pergunta', async () => {
    const { repository, useCase } = await build()
    await repository.upsertProgress('u1', 'r1', { currentStep: 3, completedAt: day })
    await repository.upsertProgress('u1', 'r2', { currentStep: 3, completedAt: day })
    expect((await useCase.execute({ userId: 'u1', lessonId: 'r2' })).recall).toBeUndefined()

    await repository.upsertProgress('u1', 'r3', { currentStep: 1, completedAt: null })
    expect((await useCase.execute({ userId: 'u1', lessonId: 'r3' })).recall).toBeUndefined()
  })

  it('outro usuário não vê a pergunta de quem concluiu', async () => {
    const { repository, useCase } = await build()
    await repository.upsertProgress('u1', 'r1', { currentStep: 3, completedAt: day })
    const result = await useCase.execute({ userId: 'u2', lessonId: 'r1' })
    expect(result.recall).toBeUndefined()
  })
})

describe('GetLessonUseCase: enquetes (LJ.2.6)', () => {
  const pollBlock = {
    type: 'poll' as const,
    id: 'enquete',
    prompt: 'E você?',
    options: ['a', 'b'],
  }
  const lesson: LessonSummary = {
    ...(lessons[0] as Omit<LessonSummary, 'blocks'>),
    id: 'p1',
    blocks: {
      schemaVersion: 1,
      phases: { scenario: [pollBlock], microDecision: [], revelation: [] },
    },
  }

  it('não traz enquete que a pessoa ainda não votou', async () => {
    const polls = createFakeLessonPollRepository()
    polls.seed('p1', 'enquete', 0, 30)
    const useCase = new GetLessonUseCase(createFakeLessonRepository([lesson]), polls)

    expect((await useCase.execute({ userId: 'u1', lessonId: 'p1' })).polls).toBeUndefined()
  })

  it('traz o voto da própria pessoa e o resultado atual depois de votar', async () => {
    const polls = createFakeLessonPollRepository()
    polls.seed('p1', 'enquete', 0, 30)
    await polls.castVote({ userId: 'u1', lessonId: 'p1', pollId: 'enquete', option: 1 })
    const useCase = new GetLessonUseCase(createFakeLessonRepository([lesson]), polls)

    const result = await useCase.execute({ userId: 'u1', lessonId: 'p1' })

    expect(result.polls).toEqual([
      { pollId: 'enquete', vote: 1, results: { total: 31, percentages: [97, 3] } },
    ])
  })
})
