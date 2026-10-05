import type {
  AchievementCatalog,
  AchievementChanges,
  CatalogAchievement,
  CatalogMission,
  GamificationCatalogAdmin,
  MissionChanges,
  NewAchievement,
} from '../ports/gamificationCatalogAdmin'
import type { RecordAdminActionUseCase } from './recordAdminAction'

// Só o que foi pedido, em snake_case, pro log de auditoria.
function achievementPayload(changes: AchievementChanges): Record<string, unknown> {
  const payload: Record<string, unknown> = {}
  if (changes.name !== undefined) payload.name = changes.name
  if (changes.description !== undefined) payload.description = changes.description
  if (changes.criteriaType !== undefined) payload.criteria_type = changes.criteriaType
  if (changes.criteriaValue !== undefined) payload.criteria_value = changes.criteriaValue
  if (changes.isActive !== undefined) payload.is_active = changes.isActive
  return payload
}

export class ListAchievementCatalogUseCase {
  constructor(private readonly catalogAdmin: GamificationCatalogAdmin) {}

  execute(): Promise<AchievementCatalog> {
    return this.catalogAdmin.listAchievements()
  }
}

export class ListMissionCatalogUseCase {
  constructor(private readonly catalogAdmin: GamificationCatalogAdmin) {}

  execute(): Promise<CatalogMission[]> {
    return this.catalogAdmin.listMissions()
  }
}

// Cria uma conquista (N.19). Auditada com o que foi pedido e o id criado.
export class CreateAchievementAdminUseCase {
  constructor(
    private readonly catalogAdmin: GamificationCatalogAdmin,
    private readonly recordAdminAction: RecordAdminActionUseCase,
  ) {}

  execute(adminId: string, input: NewAchievement): Promise<CatalogAchievement> {
    return this.recordAdminAction.run(
      {
        adminId,
        action: 'achievement.create',
        targetType: 'achievement',
        payload: achievementPayload(input),
      },
      () => this.catalogAdmin.createAchievement(input),
      (created) => ({ targetId: created.id }),
    )
  }
}

// Edita ou liga/desliga uma conquista (N.19). Desativar nunca remove o que o usuário já ganhou.
export class UpdateAchievementAdminUseCase {
  constructor(
    private readonly catalogAdmin: GamificationCatalogAdmin,
    private readonly recordAdminAction: RecordAdminActionUseCase,
  ) {}

  execute(adminId: string, id: string, changes: AchievementChanges): Promise<CatalogAchievement> {
    return this.recordAdminAction.run(
      {
        adminId,
        action: 'achievement.update',
        targetType: 'achievement',
        targetId: id,
        payload: achievementPayload(changes),
      },
      () => this.catalogAdmin.updateAchievement(id, changes),
      (updated) => ({ payload: { name_after: updated.name } }),
    )
  }
}

// Edita texto, XP ou liga/desliga uma missão (N.19). A recusa vira falha auditada.
export class UpdateMissionAdminUseCase {
  constructor(
    private readonly catalogAdmin: GamificationCatalogAdmin,
    private readonly recordAdminAction: RecordAdminActionUseCase,
  ) {}

  execute(adminId: string, id: string, changes: MissionChanges): Promise<CatalogMission> {
    const payload: Record<string, unknown> = {}
    if (changes.title !== undefined) payload.title = changes.title
    if (changes.description !== undefined) payload.description = changes.description
    if (changes.xpReward !== undefined) payload.xp_reward = changes.xpReward
    if (changes.isActive !== undefined) payload.is_active = changes.isActive

    return this.recordAdminAction.run(
      { adminId, action: 'mission.update', targetType: 'mission', targetId: id, payload },
      () => this.catalogAdmin.updateMission(id, changes),
      (updated) => ({ payload: { key: updated.key } }),
    )
  }
}
