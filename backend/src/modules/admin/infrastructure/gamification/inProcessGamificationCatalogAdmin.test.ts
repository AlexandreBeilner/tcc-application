import { describe, expect, it } from 'vitest'
import type { Achievement } from '../../../achievements/domain/achievement'
import type { Mission } from '../../../missions/domain/mission'
import {
  AdminCatalogConflictError,
  AdminCatalogNotFoundError,
  InvalidAdminCatalogError,
} from '../../domain/errors'
import { createInMemoryGamificationCatalogAdmin } from '../../test/fakes/inMemoryGamificationCatalogAdmin'

const streak7: Achievement = {
  id: 'a1',
  name: 'Primeira Semana',
  description: null,
  criteriaType: 'streak_days',
  criteriaValue: 7,
  isActive: true,
}

const feedRead: Mission = {
  id: 'm1',
  key: 'feed_read',
  title: 'Consulte o feed',
  description: null,
  completionCriteria: 'Reportado pelo cliente',
  xpReward: 30,
  requiresLessonCompletion: false,
  isActive: true,
}

function build() {
  return createInMemoryGamificationCatalogAdmin({ achievements: [streak7], missions: [feedRead] })
}

describe('inProcessGamificationCatalogAdmin', () => {
  it('lista conquistas com a contagem e a lista fechada de critérios (rótulo e tipo de meta)', async () => {
    const { catalogAdmin, achievementRepository } = build()
    await achievementRepository.unlock('u1', 'a1')

    const { achievements, criteria } = await catalogAdmin.listAchievements()

    expect(achievements).toEqual([{ ...streak7, unlockedCount: 1 }])
    expect(criteria).toHaveLength(9)
    expect(criteria.find((c) => c.type === 'net_worth')).toEqual({
      type: 'net_worth',
      label: 'Patrimônio (R$)',
      valueKind: 'currency',
    })
  })

  it('cria e edita conquista, devolvendo a contagem atual', async () => {
    const { catalogAdmin, achievementRepository } = build()
    const created = await catalogAdmin.createAchievement({
      name: 'Fiel',
      criteriaType: 'streak_days',
      criteriaValue: 30,
    })
    await achievementRepository.unlock('u1', created.id)

    const updated = await catalogAdmin.updateAchievement(created.id, { isActive: false })

    expect(created).toMatchObject({ name: 'Fiel', isActive: true, unlockedCount: 0 })
    expect(updated).toMatchObject({ id: created.id, isActive: false, unlockedCount: 1 })
  })

  it('traduz as recusas dos módulos donos: 404, 409 e 422 do painel', async () => {
    const { catalogAdmin } = build()

    await expect(
      catalogAdmin.updateAchievement('nope', { isActive: false }),
    ).rejects.toBeInstanceOf(AdminCatalogNotFoundError)
    await expect(
      catalogAdmin.createAchievement({
        name: 'primeira semana',
        criteriaType: 'streak_days',
        criteriaValue: 3,
      }),
    ).rejects.toBeInstanceOf(AdminCatalogConflictError)
    await expect(
      catalogAdmin.createAchievement({
        name: 'Nova',
        criteriaType: 'streak_days',
        criteriaValue: 2.5,
      }),
    ).rejects.toBeInstanceOf(InvalidAdminCatalogError)
    await expect(catalogAdmin.updateMission('nope', { isActive: false })).rejects.toBeInstanceOf(
      AdminCatalogNotFoundError,
    )
    await expect(catalogAdmin.updateMission('m1', { xpReward: 0 })).rejects.toBeInstanceOf(
      InvalidAdminCatalogError,
    )
  })

  it('lista e edita missões com o tipo de verificação e as conclusões', async () => {
    const { catalogAdmin, missionRepository } = build()
    await missionRepository.markCompleted('u1', 'm1', '2026-10-03')

    const [before] = await catalogAdmin.listMissions()
    const updated = await catalogAdmin.updateMission('m1', { title: 'Leia o feed', xpReward: 40 })

    expect(before).toMatchObject({
      verification: 'client_reported',
      completedUsers: 1,
      completedToday: 1,
    })
    expect(updated).toMatchObject({ title: 'Leia o feed', xpReward: 40, completedUsers: 1 })
  })
})
