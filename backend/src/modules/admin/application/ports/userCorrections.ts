export interface CorrectedProgression {
  xp: number
  level: number
  currentStreak: number
  longestStreak: number
}

export interface CorrectionAchievement {
  id: string
  name: string
  description: string | null
  unlocked: boolean
}

export interface CorrectionLesson {
  id: string
  code: string
  title: string
  trackNumber: number
  status: 'completed' | 'in_progress' | 'not_started'
}

// O que o painel precisa pra montar os seletores de correção de um usuário.
export interface UserCorrectionContext {
  achievements: CorrectionAchievement[]
  lessons: CorrectionLesson[]
}

// Correções de gamificação e de lição (N.17). Cada método passa pelo caso de uso do
// módulo dono do dado (nunca update direto) e traduz as recusas dele pros erros de
// `admin/domain/errors.ts` (`AdminCorrection*`, `InvalidAdminCorrectionError`).
export interface UserCorrections {
  getContext(userId: string): Promise<UserCorrectionContext>
  adjustXp(userId: string, delta: number): Promise<CorrectedProgression>
  setStreak(userId: string, value: number): Promise<CorrectedProgression>
  grantAchievement(userId: string, achievementId: string): Promise<{ id: string; name: string }>
  completeLesson(userId: string, lessonId: string): Promise<{ id: string; code: string }>
  reopenLesson(userId: string, lessonId: string): Promise<{ id: string; code: string }>
}
