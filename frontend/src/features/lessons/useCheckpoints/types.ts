import type { StreakMilestone } from '../answerStreak'
import type { EstimateResult } from '../../../services/lessons'

// Resposta enviada ao servidor, por formato (LJ.2.1): por índice ou, na estimativa, por valor.
// Os outros formatos de jogo acrescentam as suas variantes.
export type CheckpointResponse = { selectedOption: number } | { value: number }

// O que a tela de uma pergunta intermediária precisa saber (RC.3.2).
export interface CheckpointView {
    solved: boolean
    attempts: number
    wrongOptions: number[]
    firstTry: boolean
    // Só em acerto desta sessão (o servidor não devolve a explicação no restore).
    explanation?: string
    lastAttemptWrong: boolean
    // Estimativa respondida: o chute e o valor real (do servidor, sem a explicação no restore).
    estimate?: EstimateResult
    // Selo de sequência (LJ.1.6) ganho com esta resposta; só nesta sessão.
    streakMilestone?: StreakMilestone
}
