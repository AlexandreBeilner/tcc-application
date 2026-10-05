export type LessonMicroDecisionType =
  | 'reflection'
  | 'growth_calculator'
  | 'fixed_income_comparison'
  | 'live_indicator'
  | 'live_macro_indicator'

export interface LessonFunnelView {
  started: number
  completed: number
  abandoned: number
  completionRate: number | null
  avgSecondsToComplete: number | null
  medianSecondsToComplete: number | null
  betAnswered: number
  betCorrect: number
  betAccuracy: number | null
  // 4 posições: passo gravado (cenário, micro-decisão, revelação, desbloqueio) de quem iniciou e não concluiu.
  abandonedByStep: number[]
}

export interface LessonCatalogItem {
  id: string
  code: string
  title: string
  trackNumber: number
  trackName: string
  sortOrder: number
  microDecisionType: LessonMicroDecisionType
  hasBet: boolean
  unlocksKeys: string[]
  published: boolean
  prerequisiteCode: string | null
  funnel: LessonFunnelView
}

export interface LessonPublicationResult {
  id: string
  code: string
  title: string
  published: boolean
  waivedUsers: number
}

// Conteúdo das lições pro painel (N.18/N.23). Cada método passa pelo caso de uso do módulo
// `lessons` e traduz as recusas dele pros erros `AdminLesson*` de `admin/domain/errors.ts`.
export interface LessonCatalogAdmin {
  list(): Promise<LessonCatalogItem[]>
  setPublished(lessonId: string, published: boolean): Promise<LessonPublicationResult>
}
