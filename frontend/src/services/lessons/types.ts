// Vocabulário fixo do widget de Micro-decisão (tarefa 7.0.2) — 'reflection'
// é o padrão (sem widget embutido); os outros embutem um componente já
// existente (tarefa 6.7) — ver `pages/Lesson/index.tsx`.
export type MicroDecisionType = 'reflection' | 'growth_calculator' | 'fixed_income_comparison' | 'live_indicator' | 'live_macro_indicator'

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
    // Aposta com acerto/erro real (backlog engajamento B.1/B.3) — `null` é o
    // estado normal de hoje (passo sem pergunta); preenchido troca pro
    // widget de escolha real. O índice certo (`microDecisionCorrectOption`)
    // nunca vem aqui (correção da revisão da PR 18 — vazava a resposta antes
    // do usuário escolher); o veredito vem só de `POST /lessons/:id/answer`
    // (`AnswerMicroDecisionResult`), e o gabarito só no acerto.
    microDecisionOptions: string[] | null
    // Conteúdo visual por fase (RC.3.1), validado no frontend por
    // `features/lessons/widgets/schema`; ausente/nulo = texto legado.
    blocks?: unknown
    status: 'completed' | 'available' | 'locked'
    currentStep: number
    // Só em `GET /lessons/:id` (RC.2.3): o player restaura a pergunta já
    // resolvida e as alternativas erradas já tentadas. Ausentes na listagem.
    microDecisionSolved?: boolean
    microDecisionWrongOptions?: number[]
    // Só em `GET /lessons/:id` (RC.3.2): estado de cada pergunta intermediária
    // que o usuário já tentou, e quantas acertou de primeira.
    checkpoints?: CheckpointState[]
    checkpointsFirstTry?: number
    // Lição dispensada e ainda não feita (N.24): "nova, opcional". Sempre
    // `status: 'available'`, e conta como satisfeita no desbloqueio. O backend
    // sempre envia; opcional aqui só pra `undefined` valer como `false`.
    waived?: boolean
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

export interface CheckpointState {
    checkpointId: string
    solved: boolean
    attempts: number
    wrongOptions: number[]
    firstTry: boolean
    // Só estimativa já respondida (LJ.2.2): restaura a régua depois de sair e voltar.
    estimate?: EstimateResult
    // Só ordenar já resolvido (LJ.2.3): a ordem montada, em índices dos itens como o servidor os entregou.
    sequence?: number[]
}

// Formatos de várias peças, ao errar (LJ-D2): quantas peças estão certas, sem dizer quais.
export interface CheckHint {
    correctCount: number
    total: number
}

// Resultado de uma estimativa, devolvido só depois do chute (LJ-D1): `value` é o valor real e
// `low`/`high` a faixa que conta como "na mosca".
export interface EstimateResult {
    guess: number
    band: 'exact' | 'close' | 'far'
    value: number
    low: number
    high: number
}

// `POST /lessons/:id/checkpoints/:checkpointId/answer` (RC.3.2, `.docs/backend/lessons.md`).
export interface AnswerCheckpointResult {
    correct: boolean
    attempts: number
    firstTry: boolean
    wrongOptions: number[]
    // Só em acerto; na estimativa vem sempre (ela avança acertando ou não).
    explanation?: string
    estimate?: EstimateResult
    hint?: CheckHint
}

// `POST /lessons/:id/answer` (RC.2.3, `.docs/backend/lessons.md`).
export interface AnswerMicroDecisionResult {
    correct: boolean
    attempts: number
    firstTry: boolean
    // Alternativas erradas já tentadas; vazio quando a lição é só leitura.
    wrongOptions: number[]
    // Só em acerto: errar nunca entrega o gabarito (D3).
    correctOptionLabel?: string
}

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
    // Nível após este crédito (tarefa T.10) — consumido pelo reveal de
    // level-up pra calcular o salário novo (`monthlySalaryForLevel`).
    newLevel?: number
    streakMilestone?: number | null
    unlockedAchievements?: UnlockedAchievement[]
}

// `POST /lessons/:id/review` (backlog engajamento H.2) — sustenta a missão
// "revise uma lição antiga" com verificação cruzada de verdade.
export interface ReviewLessonResult {
    status: 'reviewed'
    // Backlog engajamento H.1 (critério `lesson_reviewed`) — revisão nunca
    // credita xp/streak, então a checagem de conquista é feita direto aqui,
    // não de carona num dos outros 2 pontos (`AdvanceLessonResult`/missões).
    // Sem consumidor de reveal ainda (`useReviewLesson` é fire-and-forget,
    // ver comentário lá) — mesmo estado "ainda sem consumidor" de
    // `streakMilestone` em `AdvanceLessonResult` quando foi introduzido.
    unlockedAchievements: UnlockedAchievement[]
}
