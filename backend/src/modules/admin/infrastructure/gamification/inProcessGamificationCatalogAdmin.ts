import type {
  AchievementCatalogEntry,
  CreateAchievementUseCase,
  ListAchievementCatalogUseCase,
  UpdateAchievementUseCase,
} from '../../../achievements/application/useCases/manageAchievementCatalog'
import {
  ACHIEVEMENT_CRITERIA,
  ACHIEVEMENT_CRITERIA_TYPES,
} from '../../../achievements/domain/catalog'
import {
  AchievementNameTakenError,
  AchievementNotFoundError,
  InvalidAchievementError,
} from '../../../achievements/domain/errors'
import type {
  ListMissionCatalogUseCase,
  MissionCatalogEntry,
  UpdateMissionUseCase,
} from '../../../missions/application/useCases/manageMissionCatalog'
import { InvalidMissionError, MissionNotFoundError } from '../../../missions/domain/errors'
import {
  AdminCatalogConflictError,
  AdminCatalogNotFoundError,
  InvalidAdminCatalogError,
} from '../../domain/errors'
import type {
  CatalogAchievement,
  CatalogMission,
  GamificationCatalogAdmin,
} from '../../application/ports/gamificationCatalogAdmin'

export interface InProcessGamificationCatalogAdminDeps {
  listAchievementCatalog: ListAchievementCatalogUseCase
  createAchievement: CreateAchievementUseCase
  updateAchievement: UpdateAchievementUseCase
  listMissionCatalog: ListMissionCatalogUseCase
  updateMission: UpdateMissionUseCase
}

function toCatalogAchievement(entry: AchievementCatalogEntry): CatalogAchievement {
  return {
    id: entry.id,
    name: entry.name,
    description: entry.description,
    criteriaType: entry.criteriaType,
    criteriaValue: entry.criteriaValue,
    isActive: entry.isActive,
    unlockedCount: entry.unlockedCount,
  }
}

function toCatalogMission(entry: MissionCatalogEntry): CatalogMission {
  return {
    id: entry.id,
    key: entry.key,
    title: entry.title,
    description: entry.description,
    completionCriteria: entry.completionCriteria,
    xpReward: entry.xpReward,
    isActive: entry.isActive,
    verification: entry.verification,
    completedUsers: entry.completedUsers,
    completedToday: entry.completedToday,
  }
}

// Traduz as recusas dos módulos donos (conquistas, missões) pros erros do painel, pra o router
// mapear 404/409/422 sem conhecer esses módulos.
function translate(err: unknown): never {
  if (err instanceof AchievementNotFoundError || err instanceof MissionNotFoundError) {
    throw new AdminCatalogNotFoundError(err.message)
  }
  if (err instanceof AchievementNameTakenError) {
    throw new AdminCatalogConflictError(err.message)
  }
  if (err instanceof InvalidAchievementError || err instanceof InvalidMissionError) {
    throw new InvalidAdminCatalogError(err.message)
  }
  throw err
}

async function guard<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation()
  } catch (err) {
    return translate(err)
  }
}

export function createInProcessGamificationCatalogAdmin(
  deps: InProcessGamificationCatalogAdminDeps,
): GamificationCatalogAdmin {
  return {
    async listAchievements() {
      const entries = await deps.listAchievementCatalog.execute()
      return {
        achievements: entries.map(toCatalogAchievement),
        criteria: ACHIEVEMENT_CRITERIA_TYPES.map((type) => ({
          type,
          label: ACHIEVEMENT_CRITERIA[type].label,
          valueKind: ACHIEVEMENT_CRITERIA[type].valueKind,
        })),
      }
    },

    createAchievement: (input) =>
      guard(async () => {
        const created = await deps.createAchievement.execute({
          name: input.name,
          description: input.description ?? null,
          criteriaType: input.criteriaType,
          criteriaValue: input.criteriaValue,
        })
        return toCatalogAchievement({ ...created, unlockedCount: 0 })
      }),

    updateAchievement: (id, changes) =>
      guard(async () => {
        const updated = await deps.updateAchievement.execute(id, changes)
        const entry = (await deps.listAchievementCatalog.execute()).find((a) => a.id === updated.id)
        return toCatalogAchievement(entry ?? { ...updated, unlockedCount: 0 })
      }),

    async listMissions() {
      return (await deps.listMissionCatalog.execute()).map(toCatalogMission)
    },

    updateMission: (id, changes) =>
      guard(async () => {
        await deps.updateMission.execute(id, changes)
        const entry = (await deps.listMissionCatalog.execute()).find((m) => m.id === id)
        if (!entry) throw new MissionNotFoundError('missão não encontrada')
        return toCatalogMission(entry)
      }),
  }
}
