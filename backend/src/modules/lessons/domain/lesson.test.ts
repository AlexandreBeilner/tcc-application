import { describe, expect, it } from 'vitest'
import { buildLessonView, isUnlocked, lessonStatus, utcDateString } from './lesson'

describe('isUnlocked', () => {
  it.each([
    [1, 0, true], // primeira lição sempre disponível, ninguém concluiu nada
    [2, 0, false],
    [2, 1, true],
    [5, 4, true], // última lição da Trilha 0 (0.5), as 4 anteriores concluídas
    [6, 4, false], // 1.1 ainda bloqueada — Trilha 0 não terminou
    [6, 5, true], // 1.1 desbloqueia só depois de concluir 0.5 (0.5 → Trilha 1)
  ])('sortOrder=%i, completedCount=%i → %s', (sortOrder, completedCount, expected) => {
    expect(isUnlocked(sortOrder, completedCount)).toBe(expected)
  })
})

describe('lessonStatus', () => {
  it('completed quando o usuário já concluiu, mesmo se a contagem global não sustentaria mais', () => {
    expect(lessonStatus({ sortOrder: 1, completedCount: 0, completedByUser: true })).toBe(
      'completed',
    )
  })

  it('available quando desbloqueada e ainda não concluída', () => {
    expect(lessonStatus({ sortOrder: 2, completedCount: 1, completedByUser: false })).toBe(
      'available',
    )
  })

  it('locked quando ainda não desbloqueada', () => {
    expect(lessonStatus({ sortOrder: 3, completedCount: 1, completedByUser: false })).toBe('locked')
  })
})

describe('buildLessonView', () => {
  const lesson = {
    id: 'l1',
    code: '0.1',
    title: 'O que é investir',
    trackNumber: 0,
    trackName: 'Trilha 0 — Fundamentos',
    sortOrder: 1,
    centralConcept: 'Investir vs poupar',
    unlocksDescription: 'Acesso ao Portfólio',
  }

  it('sem progresso: primeira lição available, currentStep=0', () => {
    const view = buildLessonView(lesson, undefined, 0)

    expect(view.status).toBe('available')
    expect(view.currentStep).toBe(0)
  })

  it('com progresso em andamento: status calculado normalmente, currentStep persistido', () => {
    const view = buildLessonView(lesson, { currentStep: 1, completedAt: null }, 0)

    expect(view.status).toBe('available')
    expect(view.currentStep).toBe(1)
  })

  it('com completedAt preenchido: completed, independente do sortOrder', () => {
    const view = buildLessonView(lesson, { currentStep: 3, completedAt: new Date() }, 0)

    expect(view.status).toBe('completed')
  })
})

describe('utcDateString', () => {
  it('formata a data em YYYY-MM-DD, UTC', () => {
    expect(utcDateString(new Date('2026-08-24T23:59:59Z'))).toBe('2026-08-24')
    expect(utcDateString(new Date('2026-08-25T00:00:00Z'))).toBe('2026-08-25')
  })
})
