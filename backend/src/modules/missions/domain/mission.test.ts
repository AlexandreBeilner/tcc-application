import { describe, expect, it } from 'vitest'
import { buildMissionView, todayUtc } from './mission'

const mission = {
  id: 'm1',
  key: 'lesson_complete',
  title: 'Complete uma lição da trilha',
  description: null,
  completionCriteria: 'Concluir qualquer lição da trilha hoje',
  xpReward: 30,
  requiresLessonCompletion: true,
}

describe('buildMissionView', () => {
  it('sem progresso: status pending', () => {
    const view = buildMissionView(mission, undefined)

    expect(view.status).toBe('pending')
  })

  it('com progresso completed: status completed', () => {
    const view = buildMissionView(mission, { status: 'completed' })

    expect(view.status).toBe('completed')
  })

  it('com progresso pending explícito: status pending', () => {
    const view = buildMissionView(mission, { status: 'pending' })

    expect(view.status).toBe('pending')
  })
})

describe('todayUtc', () => {
  it('formata a data em YYYY-MM-DD, UTC', () => {
    expect(todayUtc(new Date('2026-08-24T23:59:59Z'))).toBe('2026-08-24')
    expect(todayUtc(new Date('2026-08-25T00:00:00Z'))).toBe('2026-08-25')
  })
})
