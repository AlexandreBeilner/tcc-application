export type AchievementCriteriaKey =
  | 'net_worth'
  | 'streak_days'
  | 'lessons_completed'
  | 'trades_executed'
  | 'micro_decisions_streak'
  | 'track_completed_no_errors'
  | 'lesson_reviewed'
  | 'assemblies_participated'
  | 'referrals_qualified'
  | 'daily_word_first_try'
  | 'daily_perfect_days'

export interface CriterionOption {
  type: AchievementCriteriaKey
  label: string
  // 'currency' aceita centavos; 'integer' só contagem.
  valueKind: 'integer' | 'currency'
}

export interface CatalogAchievement {
  id: string
  name: string
  description: string | null
  criteriaType: AchievementCriteriaKey
  criteriaValue: number
  isActive: boolean
  isRare: boolean
  // Quantos usuários já ganharam.
  unlockedCount: number
}

export interface AchievementCatalog {
  achievements: CatalogAchievement[]
  // A lista fechada de regras que o código sabe avaliar: o painel escolhe uma, nunca digita.
  criteria: CriterionOption[]
}

export interface NewAchievement {
  name: string
  description?: string | null
  criteriaType: AchievementCriteriaKey
  criteriaValue: number
}

export interface AchievementChanges {
  name?: string
  description?: string | null
  criteriaType?: AchievementCriteriaKey
  criteriaValue?: number
  isActive?: boolean
  isRare?: boolean
}

export type MissionVerificationKind = 'lesson_completion' | 'server_check' | 'client_reported'

export interface CatalogMission {
  id: string
  key: string
  title: string
  description: string | null
  completionCriteria: string
  xpReward: number
  isActive: boolean
  verification: MissionVerificationKind
  completedUsers: number
  completedToday: number
}

export interface MissionChanges {
  title?: string
  description?: string | null
  xpReward?: number
  isActive?: boolean
}

// Catálogo operável de conquistas e missões diárias (N.19). Cada método passa pelo caso de uso
// do módulo dono do dado (conquistas, missões) e traduz as recusas dele pros erros
// `AdminCatalog*` e `InvalidAdminCatalogError` de `admin/domain/errors.ts`.
export interface GamificationCatalogAdmin {
  listAchievements(): Promise<AchievementCatalog>
  createAchievement(input: NewAchievement): Promise<CatalogAchievement>
  updateAchievement(id: string, changes: AchievementChanges): Promise<CatalogAchievement>
  listMissions(): Promise<CatalogMission[]>
  updateMission(id: string, changes: MissionChanges): Promise<CatalogMission>
}
