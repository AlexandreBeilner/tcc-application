import { describe, expect, it } from 'vitest'
import {
  CheckpointNotFoundError,
  InvalidCheckpointResponseError,
  LessonLockedError,
  LessonNotFoundError,
} from '../../domain/errors'
import type { LessonSummary } from '../../domain/lesson'
import { toPublicBlocks } from '../../domain/widgets/lessonBlocks'
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
  describe('ordenar (LJ-D2)', () => {
    const orderBlock = {
      type: 'check' as const,
      id: 'o1',
      kind: 'order' as const,
      prompt: 'Do menos ao mais arriscado',
      items: ['Tesouro Selic', 'CDB', 'FII', 'Ação pequena'],
      answer: [0, 1, 2, 3],
      explanation: 'porque o risco cresce',
    }
    const orderLesson: LessonSummary = {
      ...base,
      blocks: {
        schemaVersion: 1,
        phases: { scenario: [orderBlock], microDecision: [], revelation: [] },
      },
    }
    // Índices (como o cliente os recebe, embaralhados) da ordem certa.
    const shown = (
      toPublicBlocks(orderLesson.blocks)?.phases.scenario[0] as unknown as { items: string[] }
    ).items
    const right = orderBlock.items.map((item) => shown.indexOf(item))
    const swapped = [right[1], right[0], right[2], right[3]] as number[]

    function buildOrder() {
      const repo = createFakeLessonRepository([orderLesson])
      return { repo, useCase: new AnswerCheckpointUseCase(repo, () => new Date('2026-02-01')) }
    }
    const send = (useCase: AnswerCheckpointUseCase, sequence: number[]) =>
      useCase.execute({ userId: 'u1', lessonId: 'l1', checkpointId: 'o1', sequence })

    it('errar devolve só a contagem: sem explicação e sem dizer quais itens', async () => {
      const { repo, useCase } = buildOrder()

      const result = await send(useCase, swapped)

      expect(result).toEqual({
        correct: false,
        attempts: 1,
        firstTry: false,
        wrongOptions: [],
        hint: { correctCount: 2, total: 4 },
      })
      const [record] = await repo.listCheckpointsForUser('u1', 'l1')
      expect(record.solvedAt).toBeNull()
    })

    it('acertar de primeira resolve, devolve a explicação e guarda a ordem para restaurar', async () => {
      const { repo, useCase } = buildOrder()

      const result = await send(useCase, right)

      expect(result).toMatchObject({
        correct: true,
        firstTry: true,
        explanation: 'porque o risco cresce',
      })
      expect(result.hint).toBeUndefined()
      const [record] = await repo.listCheckpointsForUser('u1', 'l1')
      expect(record.solvedAt).not.toBeNull()
      expect(record.lastResponse).toEqual({ kind: 'order', sequence: right })
    })

    it('errar antes de acertar tira o "de primeira" e mantém as tentativas', async () => {
      const { useCase } = buildOrder()
      await send(useCase, swapped)

      const result = await send(useCase, right)

      expect(result).toMatchObject({ correct: true, attempts: 2, firstTry: false })
    })

    it('rejeita sequência repetida, curta ou resposta por índice', async () => {
      const { useCase } = buildOrder()

      await expect(send(useCase, [0, 0, 1, 2])).rejects.toBeInstanceOf(
        InvalidCheckpointResponseError,
      )
      await expect(send(useCase, [0, 1, 2])).rejects.toBeInstanceOf(InvalidCheckpointResponseError)
      await expect(
        useCase.execute({ userId: 'u1', lessonId: 'l1', checkpointId: 'o1', selectedOption: 0 }),
      ).rejects.toBeInstanceOf(InvalidCheckpointResponseError)
    })
  })
})
