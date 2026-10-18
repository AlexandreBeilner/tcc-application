import { describe, expect, it, vi } from 'vitest'
import { InvalidMissionError, MissionNotFoundError } from '../../domain/errors'
import type { Mission } from '../../domain/mission'
import { createFakeMissionRepository } from '../../test/fakes/fakeMissionRepository'
import { CompleteMissionUseCase } from './completeMission'
import { ListDailyMissionsUseCase } from './listDailyMissions'
import { ListMissionCatalogUseCase, UpdateMissionUseCase } from './manageMissionCatalog'

const feedRead: Mission = {
  id: 'm1',
  key: 'feed_read',
  title: 'Consulte o feed de notícias',
  description: null,
  completionCriteria: 'Reportado pelo cliente',
  xpReward: 30,
  requiresLessonCompletion: false,
  isActive: true,
}

const calculator: Mission = {
  ...feedRead,
  id: 'm2',
  key: 'calculator_compare',
  title: 'Compare dois produtos',
}

function build() {
  const repository = createFakeMissionRepository([feedRead, calculator])
  const xpAwarder = {
    award: vi
      .fn()
      .mockResolvedValue({ xp: 30, level: 1, leveledUp: false, unlockedAchievements: [] }),
  }
  const streakTracker = {
    touch: vi.fn().mockResolvedValue({
      currentStreak: 1,
      longestStreak: 1,
      milestoneReached: null,
      unlockedAchievements: [],
    }),
  }
  const never = {
    hasCompletedLessonToday: vi.fn(),
    hasReviewedOldLessonToday: vi.fn(),
    hasMicroDecisionStreakToday: vi.fn(),
  }
  return {
    repository,
    xpAwarder,
    list: new ListMissionCatalogUseCase(repository, () => '2026-10-03'),
    update: new UpdateMissionUseCase(repository),
    daily: new ListDailyMissionsUseCase(repository),
    complete: new CompleteMissionUseCase(
      repository,
      never,
      never,
      never,
      never,
      xpAwarder,
      streakTracker,
    ),
  }
}

describe('ListMissionCatalogUseCase', () => {
  it('lista ativas e desativadas, com o tipo de verificação e quantos usuários concluíram', async () => {
    const { repository, list, update } = build()
    await repository.markCompleted('u1', 'm1', '2026-10-03')
    await repository.markCompleted('u2', 'm1', '2026-10-02')
    await repository.markCompleted('u1', 'm1', '2026-10-02')
    await update.execute('m2', { isActive: false })

    const catalog = await list.execute()

    expect(catalog).toHaveLength(2)
    expect(catalog[0]).toMatchObject({
      id: 'm1',
      verification: 'client_reported',
      completedUsers: 2,
      completedToday: 1,
    })
    expect(catalog[1]).toMatchObject({ id: 'm2', isActive: false, completedUsers: 0 })
  })
})

describe('UpdateMissionUseCase', () => {
  it('edita texto e XP sem tocar o resto', async () => {
    const { update } = build()

    const updated = await update.execute('m1', { title: 'Leia o feed', xpReward: 45 })

    expect(updated).toMatchObject({
      key: 'feed_read',
      title: 'Leia o feed',
      xpReward: 45,
      isActive: true,
    })
  })

  it('recusa valor inválido e missão inexistente', async () => {
    const { update } = build()

    await expect(update.execute('m1', { xpReward: 0 })).rejects.toBeInstanceOf(InvalidMissionError)
    await expect(update.execute('nope', { isActive: false })).rejects.toBeInstanceOf(
      MissionNotFoundError,
    )
  })
})

describe('missão desativada', () => {
  it('não é sorteada pro dia: some da lista e não ganha linha de progresso nova', async () => {
    const { daily, update, repository } = build()
    await update.execute('m2', { isActive: false })

    const missions = await daily.execute({ userId: 'u1' })

    expect(missions.map((m) => m.id)).toEqual(['m1'])
    const rows = await repository.listProgressForDate('u1', new Date().toISOString().slice(0, 10))
    expect(rows.map((r) => r.missionId)).toEqual(['m1'])
  })

  it('volta pro sorteio quando reativada', async () => {
    const { daily, update } = build()
    await update.execute('m2', { isActive: false })
    await update.execute('m2', { isActive: true })

    const missions = await daily.execute({ userId: 'u1' })

    expect(missions.map((m) => m.id).sort()).toEqual(['m1', 'm2'])
  })

  it('não pode mais ser concluída (404), e não credita XP', async () => {
    const { complete, update, xpAwarder } = build()
    await update.execute('m1', { isActive: false })

    await expect(complete.execute({ userId: 'u1', missionId: 'm1' })).rejects.toBeInstanceOf(
      MissionNotFoundError,
    )
    expect(xpAwarder.award).not.toHaveBeenCalled()
  })

  it('não tira o que já foi concluído: o histórico e a contagem continuam', async () => {
    const { complete, update, list } = build()
    await complete.execute({ userId: 'u1', missionId: 'm1' })
    await update.execute('m1', { isActive: false })

    const catalog = await list.execute()

    expect(catalog.find((m) => m.id === 'm1')).toMatchObject({ isActive: false, completedUsers: 1 })
  })
})
