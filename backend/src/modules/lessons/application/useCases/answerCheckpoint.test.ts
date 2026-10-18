import { describe, expect, it } from 'vitest'
import {
  CheckpointNotFoundError,
  InvalidCheckpointResponseError,
  LessonLockedError,
  LessonNotFoundError,
} from '../../domain/errors'
import type { LessonSummary } from '../../domain/lesson'
import { createFakeLessonRepository } from '../../test/fakes/fakeLessonRepository'
import { AnswerCheckpointUseCase } from './answerCheckpoint'

const base: LessonSummary = {
  id: 'l1',
  code: '0.1',
  title: 'Lição',
  trackNumber: 0,
  trackName: 'Trilha 0',
  sortOrder: 1,
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
      scenario: [
        {
          type: 'check',
          id: 'c1',
          kind: 'single',
          prompt: 'p',
          options: ['a', 'b', 'c'],
          answer: 1,
          explanation: 'porque b',
        },
      ],
      microDecision: [],
      revelation: [],
    },
  },
}
const locked: LessonSummary = { ...base, id: 'l2', sortOrder: 2 }

function build() {
  const repo = createFakeLessonRepository([base, locked])
  const useCase = new AnswerCheckpointUseCase(repo, () => new Date('2026-02-01T00:00:00Z'))
  return { repo, useCase }
}

const answer = (
  useCase: AnswerCheckpointUseCase,
  body: { selectedOption: number },
  checkpointId = 'c1',
  lessonId = 'l1',
) => useCase.execute({ userId: 'u1', lessonId, checkpointId, ...body })

describe('AnswerCheckpointUseCase', () => {
  it('erro: sem explicação, conta a tentativa e devolve a alternativa errada', async () => {
    const { useCase } = build()

    const result = await answer(useCase, { selectedOption: 0 })

    expect(result).toEqual({ correct: false, attempts: 1, firstTry: false, wrongOptions: [0] })
    expect(result).not.toHaveProperty('explanation')
  })

  it('tentativas ilimitadas, erros sem repetir, acerto traz a explicação e não é "de primeira"', async () => {
    const { useCase } = build()

    await answer(useCase, { selectedOption: 0 })
    await answer(useCase, { selectedOption: 0 })
    await answer(useCase, { selectedOption: 2 })
    const result = await answer(useCase, { selectedOption: 1 })

    expect(result).toEqual({
      correct: true,
      attempts: 4,
      firstTry: false,
      wrongOptions: [0, 2],
      explanation: 'porque b',
    })
  })

  it('acerto de primeira', async () => {
    const { useCase } = build()

    expect(await answer(useCase, { selectedOption: 1 })).toMatchObject({
      correct: true,
      attempts: 1,
      firstTry: true,
    })
  })

  it('já resolvido responde sem gravar (revisão sem estado)', async () => {
    const { repo, useCase } = build()
    await answer(useCase, { selectedOption: 1 })

    const again = await answer(useCase, { selectedOption: 0 })

    expect(again).toMatchObject({ correct: false, wrongOptions: [] })
    const [record] = await repo.listCheckpointsForUser('u1', 'l1')
    expect(record).toMatchObject({ attempts: 1, wrongOptions: [] })
    expect(record.solvedAt).not.toBeNull()
  })

  it('lição concluída responde sem gravar nada', async () => {
    const { repo, useCase } = build()
    await repo.upsertProgress('u1', 'l1', { currentStep: 3, completedAt: new Date() })

    await answer(useCase, { selectedOption: 0 })

    expect(await repo.listCheckpointsForUser('u1', 'l1')).toEqual([])
  })

  it('rejeita lição inexistente, bloqueada, checkpoint inexistente e resposta fora do formato', async () => {
    const { useCase } = build()

    await expect(answer(useCase, { selectedOption: 0 }, 'c1', 'nope')).rejects.toBeInstanceOf(
      LessonNotFoundError,
    )
    await expect(answer(useCase, { selectedOption: 0 }, 'x', 'l1')).rejects.toBeInstanceOf(
      CheckpointNotFoundError,
    )
    await expect(answer(useCase, { selectedOption: 7 })).rejects.toBeInstanceOf(
      InvalidCheckpointResponseError,
    )
  })

  it('lição bloqueada devolve LessonLockedError', async () => {
    const { useCase } = build()

    await expect(answer(useCase, { selectedOption: 0 }, 'c1', 'l2')).rejects.toBeInstanceOf(
      LessonLockedError,
    )
  })

  describe('estimativa (LJ-D1)', () => {
    const estimateLesson: LessonSummary = {
      ...base,
      blocks: {
        schemaVersion: 1,
        phases: {
          scenario: [
            {
              type: 'check',
              id: 'e1',
              kind: 'estimate',
              prompt: 'Quanto viram?',
              min: 1000,
              max: 10000,
              step: 100,
              unit: 'brl',
              answer: 6000,
              tolerancePct: 10,
              explanation: 'porque juros sobre juros',
            },
          ],
          microDecision: [],
          revelation: [],
        },
      },
    }

    function buildEstimate() {
      const repo = createFakeLessonRepository([estimateLesson])
      return { repo, useCase: new AnswerCheckpointUseCase(repo, () => new Date('2026-02-01')) }
    }
    const guess = (useCase: AnswerCheckpointUseCase, value: number) =>
      useCase.execute({ userId: 'u1', lessonId: 'l1', checkpointId: 'e1', value })

    it('chute longe avança na hora: resolve na 1ª resposta, mostra o valor real e a explicação', async () => {
      const { repo, useCase } = buildEstimate()

      const result = await guess(useCase, 3000)

      expect(result).toMatchObject({
        correct: false,
        attempts: 1,
        firstTry: false,
        explanation: 'porque juros sobre juros',
        estimate: { guess: 3000, band: 'far', value: 6000, low: 5400, high: 6600 },
      })
      const [record] = await repo.listCheckpointsForUser('u1', 'l1')
      expect(record.solvedAt).not.toBeNull()
      expect(record.lastResponse).toEqual({ kind: 'estimate', value: 3000, hit: false })
    })

    it('chute na faixa é "na mosca" e conta como de primeira', async () => {
      const { useCase } = buildEstimate()

      expect(await guess(useCase, 6300)).toMatchObject({
        correct: true,
        firstTry: true,
        estimate: { band: 'exact' },
      })
    })

    it('chute perto da faixa não é na mosca, mas também avança', async () => {
      const { useCase } = buildEstimate()

      expect(await guess(useCase, 7000)).toMatchObject({
        correct: false,
        explanation: 'porque juros sobre juros',
        estimate: { band: 'close' },
      })
    })

    it('segunda resposta não regrava: o primeiro chute vale', async () => {
      const { repo, useCase } = buildEstimate()
      await guess(useCase, 3000)

      await guess(useCase, 6000)

      const [record] = await repo.listCheckpointsForUser('u1', 'l1')
      expect(record).toMatchObject({ attempts: 1, lastResponse: { value: 3000, hit: false } })
    })

    it('rejeita valor fora da régua e resposta por índice', async () => {
      const { useCase } = buildEstimate()

      await expect(guess(useCase, 999)).rejects.toBeInstanceOf(InvalidCheckpointResponseError)
      await expect(
        useCase.execute({ userId: 'u1', lessonId: 'l1', checkpointId: 'e1', selectedOption: 0 }),
      ).rejects.toBeInstanceOf(InvalidCheckpointResponseError)
    })

    it('pergunta por índice recebendo `value` também é inválida', async () => {
      const { useCase } = build()

      await expect(
        useCase.execute({ userId: 'u1', lessonId: 'l1', checkpointId: 'c1', value: 1 }),
      ).rejects.toBeInstanceOf(InvalidCheckpointResponseError)
    })
  })
})
