import { afterEach, describe, expect, it, vi } from 'vitest'
import { createFakeMissionRepository } from '../../test/fakes/fakeMissionRepository'
import { ListDailyMissionsUseCase } from './listDailyMissions'

const catalog = [
  {
    id: 'm1',
    key: 'lesson_complete',
    title: 'Complete uma lição da trilha',
    description: null,
    completionCriteria: 'Concluir qualquer lição hoje',
    xpReward: 30,
    requiresLessonCompletion: true,
    isActive: true,
  },
  {
    id: 'm2',
    key: 'feed_read',
    title: 'Consulte o feed de notícias',
    description: null,
    completionCriteria: 'Abrir o feed de notícias',
    xpReward: 30,
    requiresLessonCompletion: false,
    isActive: true,
  },
]

describe('ListDailyMissionsUseCase', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('gera as linhas pending de hoje sob demanda e devolve o catálogo com status', async () => {
    const repository = createFakeMissionRepository(catalog)
    const useCase = new ListDailyMissionsUseCase(repository)

    const missions = await useCase.execute({ userId: 'u1' })

    expect(missions).toHaveLength(2)
    expect(missions.every((m) => m.status === 'pending')).toBe(true)
  })

  it('reflete missão já concluída hoje', async () => {
    const repository = createFakeMissionRepository(catalog)
    await repository.ensureTodayProgress('u1', ['m1', 'm2'], '2026-08-24')
    await repository.markCompleted('u1', 'm1', '2026-08-24')
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-24T12:00:00Z'))
    const useCase = new ListDailyMissionsUseCase(repository)

    const missions = await useCase.execute({ userId: 'u1' })

    expect(missions.find((m) => m.id === 'm1')?.status).toBe('completed')
    expect(missions.find((m) => m.id === 'm2')?.status).toBe('pending')
  })

  it('catálogo renovado por dia — completar hoje não afeta o registro de amanhã', async () => {
    const repository = createFakeMissionRepository(catalog)
    const useCase = new ListDailyMissionsUseCase(repository)

    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-24T12:00:00Z'))
    await repository.ensureTodayProgress('u1', ['m1'], '2026-08-24')
    await repository.markCompleted('u1', 'm1', '2026-08-24')

    vi.setSystemTime(new Date('2026-08-25T12:00:00Z'))
    const missionsNextDay = await useCase.execute({ userId: 'u1' })

    expect(missionsNextDay.find((m) => m.id === 'm1')?.status).toBe('pending')
  })
})
