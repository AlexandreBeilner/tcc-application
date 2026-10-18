import type { StreakMilestone } from '../answerStreak'

// O que a tela de uma pergunta intermediária precisa saber (RC.3.2).
export interface CheckpointView {
    solved: boolean
    attempts: number
    wrongOptions: number[]
    firstTry: boolean
    // Só em acerto desta sessão (o servidor não devolve a explicação no restore).
    explanation?: string
    lastAttemptWrong: boolean
    // Selo de sequência (LJ.1.6) ganho com esta resposta; só nesta sessão.
    streakMilestone?: StreakMilestone
}
