import { describe, expect, it } from 'vitest'
import {
  InvalidMicroDecisionOptionError,
  LessonLockedError,
  LessonNotFoundError,
  LessonStepOutOfOrderError,
  NoMicroDecisionError,
} from '../../domain/errors'
import type { LessonSummary } from '../../domain/lesson'
import { createFakeLessonRepository } from '../../test/fakes/fakeLessonRepository'
import { AnswerMicroDecisionUseCase } from './answerMicroDecision'

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
  microDecisionOptions: ['Sim', 'Não', 'Talvez'],
  microDecisionCorrectOption: 0,
}
const withoutBet: LessonSummary = {
  ...base,
  id: 'l0',
  sortOrder: 2,
  microDecisionOptions: null,
  microDecisionCorrectOption: null,
}

function build() {
  const repo = createFakeLessonRepository([base, withoutBet])
  const useCase = new AnswerMicroDecisionUseCase(repo, () => new Date('2026-02-01T00:00:00Z'))
  return { repo, useCase }
}

const answer = (useCase: AnswerMicroDecisionUseCase, selectedOption: number, lessonId = 'l1') =>
  useCase.execute({ userId: 'u1', lessonId, selectedOption })

describe('AnswerMicroDecisionUseCase', () => {
  it('erro: não entrega o gabarito, conta a tentativa e devolve as alternativas erradas já tentadas', async () => {
    const { repo, useCase } = build()
    await repo.upsertProgress('u1', 'l1', { currentStep: 1, completedAt: null })

    const result = await answer(useCase, 1)

    expect(result).toEqual({ correct: false, attempts: 1, firstTry: false, wrongOptions: [1] })
    expect(result).not.toHaveProperty('correctOptionLabel')
  })

  it('tentativas ilimitadas: acumula erros sem repetir e acerta no fim com o gabarito', async () => {
    const { repo, useCase } = build()
    await repo.upsertProgress('u1', 'l1', { currentStep: 1, completedAt: null })

    await answer(useCase, 1)
    await answer(useCase, 1)
    await answer(useCase, 2)
    const result = await answer(useCase, 0)

    expect(result).toEqual({
      correct: true,
      attempts: 4,
      firstTry: false,
      wrongOptions: [1, 2],
      correctOptionLabel: 'Sim',
    })
    const [progress] = await repo.listProgressForUser('u1')
    expect(progress.microDecisionSolvedAt).toEqual(new Date('2026-02-01T00:00:00Z'))
  })

  it('a primeira escolha é imutável', async () => {
    const { repo, useCase } = build()
    await repo.upsertProgress('u1', 'l1', { currentStep: 1, completedAt: null })

    await answer(useCase, 2)
    await answer(useCase, 0)

    const [progress] = await repo.listProgressForUser('u1')
    expect(progress.microDecisionSelectedOption).toBe(2)
  })

  it('acerto de primeira', async () => {
    const { repo, useCase } = build()
    await repo.upsertProgress('u1', 'l1', { currentStep: 1, completedAt: null })

    expect(await answer(useCase, 0)).toMatchObject({ correct: true, attempts: 1, firstTry: true })
  })

  it('não toca updatedAt (o intervalo mínimo entre passos não reinicia)', async () => {
    const { repo, useCase } = build()
    const saved = await repo.upsertProgress('u1', 'l1', { currentStep: 1, completedAt: null })

    await answer(useCase, 1)

    const [progress] = await repo.listProgressForUser('u1')
    expect(progress.updatedAt).toEqual(saved.updatedAt)
  })

  it('depois de resolvida, responder de novo não grava nada (sem estado)', async () => {
    const { repo, useCase } = build()
    await repo.upsertProgress('u1', 'l1', { currentStep: 1, completedAt: null })
    await answer(useCase, 0)

    const again = await answer(useCase, 1)

    expect(again).toMatchObject({ correct: false, attempts: 1, wrongOptions: [] })
    const [progress] = await repo.listProgressForUser('u1')
    expect(progress.microDecisionAttempts).toBe(1)
    expect(progress.microDecisionWrongOptions).toEqual([])
  })

  it('lição concluída: revisão sem estado, não grava nada', async () => {
    const { repo, useCase } = build()
    await repo.upsertProgress('u1', 'l1', {
      currentStep: 3,
      completedAt: new Date('2026-01-01T00:00:00Z'),
    })

    const result = await answer(useCase, 0)

    expect(result).toMatchObject({ correct: true, correctOptionLabel: 'Sim' })
    const [progress] = await repo.listProgressForUser('u1')
    expect(progress.microDecisionAttempts).toBe(0)
    expect(progress.microDecisionSelectedOption).toBeNull()
  })

  it('só depois de sair do Cenário: sem progresso ou no passo 0, 422', async () => {
    const { repo, useCase } = build()

    await expect(answer(useCase, 0)).rejects.toBeInstanceOf(LessonStepOutOfOrderError)
    await repo.upsertProgress('u1', 'l1', { currentStep: 0, completedAt: null })
    await expect(answer(useCase, 0)).rejects.toBeInstanceOf(LessonStepOutOfOrderError)
  })

  it('lição sem pergunta com alternativas, opção fora do intervalo, inexistente e bloqueada', async () => {
    const { repo, useCase } = build()
    await repo.upsertProgress('u1', 'l1', { currentStep: 1, completedAt: null })

    await expect(answer(useCase, 0, 'l0')).rejects.toBeInstanceOf(NoMicroDecisionError)
    await expect(answer(useCase, 3)).rejects.toBeInstanceOf(InvalidMicroDecisionOptionError)
    await expect(answer(useCase, 0, 'nope')).rejects.toBeInstanceOf(LessonNotFoundError)

    const locked = createFakeLessonRepository([base, { ...base, id: 'l3', sortOrder: 5 }])
    await expect(
      new AnswerMicroDecisionUseCase(locked).execute({
        userId: 'u1',
        lessonId: 'l3',
        selectedOption: 0,
      }),
    ).rejects.toBeInstanceOf(LessonLockedError)
  })
})
