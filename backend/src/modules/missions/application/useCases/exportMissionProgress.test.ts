import { describe, expect, it } from 'vitest'
import { createFakeMissionRepository } from '../../test/fakes/fakeMissionRepository'
import { ExportMissionProgressUseCase } from './exportMissionProgress'

const catalog = [
  {
    id: 'm1',
    key: 'missao_1',
    title: 'Missão 1',
    description: null,
    completionCriteria: 'x',
    xpReward: 10,
    requiresLessonCompletion: false,
  },
]

describe('ExportMissionProgressUseCase', () => {
  it('devolve todo o histórico de progresso do usuário', async () => {
    const repository = createFakeMissionRepository(catalog)
    await repository.ensureTodayProgress('u1', ['m1'], '2026-08-25')
    await repository.markCompleted('u1', 'm1', '2026-08-25')
    const useCase = new ExportMissionProgressUseCase(repository)

    const result = await useCase.execute({ userId: 'u1' })

    expect(result).toEqual([
      { missionId: 'm1', missionDate: '2026-08-25', status: 'completed', completedAt: null },
    ])
  })

  it('lista vazia pra usuário sem nenhum progresso', async () => {
    const repository = createFakeMissionRepository(catalog)
    const useCase = new ExportMissionProgressUseCase(repository)

    expect(await useCase.execute({ userId: 'u1' })).toEqual([])
  })
})
