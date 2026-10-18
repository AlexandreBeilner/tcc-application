import { describe, expect, it } from 'vitest'
import { CheckpointNotFoundError, LessonNotFoundError } from '../../domain/errors'
import type { LessonSummary } from '../../domain/lesson'
import { createFakeLessonRepository } from '../../test/fakes/fakeLessonRepository'
import { GetReviewSessionUseCase } from './getReviewSession'
import { RecordReviewResultUseCase } from './recordReviewResult'

const day = 24 * 60 * 60 * 1000
const solvedAt = new Date('2026-10-01T12:00:00Z')

function lesson(n: number, checks: string[]): LessonSummary {
  return {
    id: `l${n}`,
    code: `0.${n}`,
    title: `Lição ${n}`,
    trackNumber: 0,
    trackName: 'T',
    sortOrder: n,
    centralConcept: 'x',
    scenarioText: '',
    microDecisionPrompt: '',
    microDecisionType: 'reflection',
    microDecisionAssetTicker: null,
    revelationText: '',
    unlocksDescription: null,
    unlocksKeys: [],
    unlocksAssetTicker: null,
    microDecisionOptions: null,
    microDecisionCorrectOption: null,
    blocks: {
      schemaVersion: 1,
      phases: {
        scenario: checks.map((id) => ({
          type: 'check' as const,
          id,
          kind: 'single' as const,
          prompt: id,
          options: ['a', 'b'],
          answer: 0,
          explanation: 'x',
        })),
        microDecision: [],
        revelation: [],
      },
    },
  }
}

async function setup(clockAt: () => Date) {
  const repo = createFakeLessonRepository([lesson(1, ['a', 'b', 'c', 'd'])])
  // Quatro perguntas resolvidas depois de errar, entrando na fila 1 dia depois.
  for (const id of ['a', 'b', 'c', 'd']) {
    await repo.recordCheckpointAnswer('u1', 'l1', id, {
      choice: 1,
      correct: false,
      answeredAt: solvedAt,
    })
    await repo.recordCheckpointAnswer('u1', 'l1', id, {
      choice: 0,
      correct: true,
      answeredAt: solvedAt,
      reviewDueAt: new Date(solvedAt.getTime() + day),
    })
  }
  return {
    repo,
    session: new GetReviewSessionUseCase(repo, clockAt),
    record: new RecordReviewResultUseCase(repo, clockAt),
  }
}

describe('GetReviewSessionUseCase', () => {
  it('antes do vencimento não há revisão', async () => {
    const { session } = await setup(() => new Date(solvedAt.getTime() + day / 2))
    expect(await session.execute({ userId: 'u1' })).toEqual({ ready: false, questions: [] })
  })

  it('vencidas, devolve exatamente três perguntas', async () => {
    const { session } = await setup(() => new Date(solvedAt.getTime() + 2 * day))
    const result = await session.execute({ userId: 'u1' })
    expect(result.ready).toBe(true)
    expect(result.questions).toHaveLength(3)
  })

  it('com menos de três vencidas o cartão não aparece', async () => {
    const { session, record } = await setup(() => new Date(solvedAt.getTime() + 2 * day))
    await record.execute({ userId: 'u1', lessonId: 'l1', checkpointId: 'a', correct: true })
    await record.execute({ userId: 'u1', lessonId: 'l1', checkpointId: 'b', correct: true })
    expect((await session.execute({ userId: 'u1' })).ready).toBe(false)
  })

  it('não mostra a revisão de outra pessoa', async () => {
    const { session } = await setup(() => new Date(solvedAt.getTime() + 2 * day))
    expect(await session.execute({ userId: 'u2' })).toEqual({ ready: false, questions: [] })
  })
})

describe('RecordReviewResultUseCase', () => {
  const at = new Date(solvedAt.getTime() + 2 * day)

  it('acertar avança o estágio e reagenda para 3 dias depois', async () => {
    const { repo, record } = await setup(() => at)
    expect(
      await record.execute({ userId: 'u1', lessonId: 'l1', checkpointId: 'a', correct: true }),
    ).toEqual({
      recorded: true,
    })
    const a = (await repo.listCheckpointsForUser('u1', 'l1')).find((c) => c.checkpointId === 'a')
    expect(a).toMatchObject({ reviewStage: 1, reviewDueAt: new Date(at.getTime() + 3 * day) })
  })

  it('errar volta ao primeiro estágio, sem sair da fila', async () => {
    const { repo, record } = await setup(() => at)
    await record.execute({ userId: 'u1', lessonId: 'l1', checkpointId: 'a', correct: true })
    const later = new RecordReviewResultUseCase(repo, () => new Date(at.getTime() + 4 * day))
    await later.execute({ userId: 'u1', lessonId: 'l1', checkpointId: 'a', correct: false })
    const a = (await repo.listCheckpointsForUser('u1', 'l1')).find((c) => c.checkpointId === 'a')
    expect(a).toMatchObject({ reviewStage: 0, reviewDueAt: new Date(at.getTime() + 5 * day) })
  })

  it('o terceiro acerto tira a pergunta da fila', async () => {
    const { repo } = await setup(() => at)
    let clock = at
    const useCase = new RecordReviewResultUseCase(repo, () => clock)
    for (const gap of [0, 4, 12]) {
      clock = new Date(at.getTime() + gap * day)
      await useCase.execute({ userId: 'u1', lessonId: 'l1', checkpointId: 'a', correct: true })
    }
    const a = (await repo.listCheckpointsForUser('u1', 'l1')).find((c) => c.checkpointId === 'a')
    expect(a).toMatchObject({ reviewStage: 3, reviewDueAt: null })
  })

  it('só age em pergunta vencida: repetir o envio não avança duas vezes', async () => {
    const { record } = await setup(() => at)
    await record.execute({ userId: 'u1', lessonId: 'l1', checkpointId: 'a', correct: true })
    expect(
      await record.execute({ userId: 'u1', lessonId: 'l1', checkpointId: 'a', correct: true }),
    ).toEqual({
      recorded: false,
    })
  })

  it('lição ou pergunta inexistente', async () => {
    const { record } = await setup(() => at)
    await expect(
      record.execute({ userId: 'u1', lessonId: 'zz', checkpointId: 'a', correct: true }),
    ).rejects.toBeInstanceOf(LessonNotFoundError)
    await expect(
      record.execute({ userId: 'u1', lessonId: 'l1', checkpointId: 'zz', correct: true }),
    ).rejects.toBeInstanceOf(CheckpointNotFoundError)
  })
})
