import { describe, expect, it } from 'vitest'
import type { LessonSummary, UserCheckpointRecord } from './lesson'
import {
  buildReviewSession,
  firstReview,
  isReviewDue,
  nextReview,
  REVIEW_SESSION_SIZE,
} from './review'

const now = new Date('2026-10-18T12:00:00Z')
const days = (n: number) => new Date(now.getTime() + n * 24 * 60 * 60 * 1000)

describe('agendamento da revisão espaçada', () => {
  it('entra na fila com o primeiro retorno em 1 dia', () => {
    expect(firstReview(now)).toEqual({ stage: 0, dueAt: days(1) })
  })

  it.each([
    [0, true, { stage: 1, dueAt: days(3) }],
    [1, true, { stage: 2, dueAt: days(7) }],
    [2, true, { stage: 3, dueAt: null }],
    [0, false, { stage: 0, dueAt: days(1) }],
    [1, false, { stage: 0, dueAt: days(1) }],
    [2, false, { stage: 0, dueAt: days(1) }],
  ])('estágio %i, acerto=%s', (stage, correct, expected) => {
    expect(nextReview(stage, correct, now)).toEqual(expected)
  })

  it('vence no instante marcado e nunca sem data', () => {
    expect(isReviewDue(now, now)).toBe(true)
    expect(isReviewDue(days(1), now)).toBe(false)
    expect(isReviewDue(null, now)).toBe(false)
    expect(isReviewDue(undefined, now)).toBe(false)
  })
})

function lesson(n: number, checkIds: string[]): LessonSummary {
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
        scenario: checkIds.map((id) => ({
          type: 'check' as const,
          id,
          kind: 'single' as const,
          prompt: id,
          options: ['a', 'b'],
          answer: 0,
          explanation: 'segredo',
        })),
        microDecision: [],
        revelation: [],
      },
    },
  }
}

const due = (lessonId: string, checkpointId: string, dueInDays: number): UserCheckpointRecord => ({
  lessonId,
  checkpointId,
  attempts: 2,
  wrongOptions: [],
  solvedAt: now,
  reviewStage: 0,
  reviewDueAt: days(dueInDays),
})

describe('buildReviewSession', () => {
  const lessons = [lesson(1, ['a', 'b']), lesson(2, ['c', 'd'])]

  it('monta três perguntas, as vencidas há mais tempo primeiro, sem gabarito', () => {
    const session = buildReviewSession(
      [due('l1', 'a', -1), due('l1', 'b', -5), due('l2', 'c', -3), due('l2', 'd', -2)],
      lessons,
    )

    expect(session.map((q) => q.block.id)).toEqual(['b', 'c', 'd'])
    expect(session[0]).toMatchObject({ lessonId: 'l1', lessonTitle: 'Lição 1' })
    expect(JSON.stringify(session)).not.toContain('segredo')
  })

  it('pergunta que sumiu do conteúdo é descartada; abaixo do mínimo não monta nada', () => {
    const records = [due('l1', 'a', -1), due('l1', 'velha', -2), due('l2', 'c', -3)]
    expect(records.length).toBe(REVIEW_SESSION_SIZE)
    expect(buildReviewSession(records, lessons)).toEqual([])
  })
})
