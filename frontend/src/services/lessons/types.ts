// Vocabulário fixo do widget de Micro-decisão (tarefa 7.0.2) — 'reflection'
// é o padrão (checkbox "já pensei"); os outros embutem um componente já
// existente (tarefa 6.7) — ver `pages/Lesson/index.tsx`.
export type MicroDecisionType = 'reflection' | 'growth_calculator' | 'fixed_income_comparison' | 'live_indicator'

// Espelha `.docs/backend/lessons.md` (`GET /lessons`) — `status` já vem
// calculado por usuário (`completed`/`available`/`locked`), ordenado por
// `sortOrder`; o frontend nunca recalcula bloqueio no cliente.
export interface Lesson {
    id: string
    code: string
    title: string
    trackNumber: number
    trackName: string
    sortOrder: number
    centralConcept: string
    // Conteúdo pedagógico real por passo (tarefa 7.0.2) — pode vir vazio
    // (`''`) pra lição ainda não autorada (autoria é a 7.1), estado de
    // transição esperado, não bug.
    scenarioText: string
    microDecisionPrompt: string
    microDecisionType: MicroDecisionType
    microDecisionAssetTicker: string | null
    revelationText: string
    unlocksDescription: string
    // Vocabulário fixo (tarefa 7.0.1): 'portfolio', 'calculator', 'news_feed'
    // ou 'asset:<AssetType>' — ver `features/lessons/unlockedKeys.ts`, que
    // espelha em TS puro o mesmo cálculo do backend a partir deste campo,
    // sem endpoint novo.
    unlocksKeys: string[]
    // Preenchido só quando unlocksKeys inclui um `asset:*` — ticker real do
    // produto recém-desbloqueado, usado pelo CTA "Comprar agora" do passo
    // Desbloqueio.
    unlocksAssetTicker: string | null
    status: 'completed' | 'available' | 'locked'
    currentStep: number
}

export interface ListLessonsResult {
    lessons: Lesson[]
}

export interface GetLessonResult {
    lesson: Lesson
}

// Recém-desbloqueada nesta chamada (`.docs/backend/lessons.md`).
export interface UnlockedAchievement {
    id: string
    name: string
    description: string | null
}

// `GET /lessons/:id` reaproveita o mesmo formato de `Lesson` (`.docs/backend/lessons.md`).
export interface AdvanceLessonResult {
    currentStep: number
    completed: boolean
    // Presentes só quando esta chamada é quem conclui a lição pela primeira
    // vez (backlog engajamento I.2) — ausentes ao reabrir uma lição já
    // concluída. `xpAwarded`/`leveledUp` consumidos pelo reveal de XP/nível
    // (I.3, `features/shell/xpRewardReveal`); `streakMilestone`/
    // `unlockedAchievements` ainda sem consumidor (I.4/I.5).
    xpAwarded?: number
    leveledUp?: boolean
    streakMilestone?: number | null
    unlockedAchievements?: UnlockedAchievement[]
}

// `POST /lessons/:id/review` (backlog engajamento H.2) — sustenta a missão
// "revise uma lição antiga" com verificação cruzada de verdade.
export interface ReviewLessonResult {
    status: 'reviewed'
}
