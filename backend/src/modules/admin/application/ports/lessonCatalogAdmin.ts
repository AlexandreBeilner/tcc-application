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

// Funil por cartão (LJ.5.1): quantas pessoas chegaram a cada cartão do player nos últimos `days` dias.
export interface LessonCardFunnelBar {
  // 0 Cenário, 1 Micro-decisão, 2 Revelação, 3 tela final.
  phase: number
  cardIndex: number
  reached: number
  lost: number
  lostRate: number | null
}

export interface LessonCardFunnelView {
  lesson: { id: string; code: string; title: string }
  days: number
  since: string
  bars: LessonCardFunnelBar[]
  biggestDrop: { phase: number; cardIndex: number } | null
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

// Conteúdo editável de uma lição (N.23), o mesmo que o jogador lê (menos a resposta certa, que o
// painel precisa ver pra editar).
export interface LessonContentView {
  title: string
  centralConcept: string
  scenarioText: string
  microDecisionPrompt: string
  microDecisionType: LessonMicroDecisionType
  microDecisionAssetTicker: string | null
  microDecisionOptions: string[] | null
  microDecisionCorrectOption: number | null
  revelationText: string
  unlocksDescription: string | null
  unlocksKeys: string[]
  unlocksAssetTicker: string | null
}

export interface LessonDetailView {
  id: string
  code: string
  trackNumber: number
  trackName: string
  sortOrder: number
  published: boolean
  content: LessonContentView
}

export type LessonRevisionKind = 'baseline' | 'create' | 'update' | 'restore'

export interface LessonRevisionItem {
  id: string
  action: LessonRevisionKind
  adminId: string | null
  adminUsername: string | null
  createdAt: Date
}

export interface LessonRevisionDetail extends LessonRevisionItem {
  content: LessonContentView
}

export interface LessonForEditView {
  lesson: LessonDetailView
  revisions: LessonRevisionItem[]
}

export interface LessonSaveOutcome {
  lesson: LessonDetailView
  warnings: string[]
  // Nomes (camelCase) dos campos que mudaram, pra auditoria.
  changedFields: string[]
}

export interface LessonCreateOutcome {
  lesson: LessonDetailView
  warnings: string[]
  waivedUsers: number
}

// Conteúdo das lições pro painel (N.18/N.23). Cada método passa pelo caso de uso do módulo
// `lessons` e traduz as recusas dele pros erros `AdminLesson*` de `admin/domain/errors.ts`.
// `adminId` entra nas escritas só pra assinar a revisão.
export interface LessonCatalogAdmin {
  list(): Promise<LessonCatalogItem[]>
  cardFunnel(lessonId: string, days?: number): Promise<LessonCardFunnelView>
  setPublished(lessonId: string, published: boolean): Promise<LessonPublicationResult>
  get(lessonId: string): Promise<LessonForEditView>
  update(adminId: string, lessonId: string, content: LessonContentView): Promise<LessonSaveOutcome>
  create(
    adminId: string,
    input: { content: LessonContentView; afterLessonId: string | null },
  ): Promise<LessonCreateOutcome>
  getRevision(lessonId: string, revisionId: string): Promise<LessonRevisionDetail>
  restore(adminId: string, lessonId: string, revisionId: string): Promise<LessonSaveOutcome>
}
