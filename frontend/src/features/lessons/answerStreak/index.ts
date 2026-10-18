// Sequência de acertos de primeira dentro da lição (LJ.1.6). Vive só na memória da sessão da lição: não grava
// nada e não mexe em XP. Errar zera o contador em silêncio (a tela nunca diz que a sequência acabou).

export type StreakMilestone = 3 | 5

export interface StreakAnswer {
    correct: boolean
    firstTry: boolean
}

// Só o acerto de primeira, sem erro antes na mesma pergunta, estende a sequência; qualquer outra resposta zera.
export function nextStreak(streak: number, answer: StreakAnswer): number {
    return answer.correct && answer.firstTry ? streak + 1 : 0
}

// O selo aparece exatamente ao chegar a 3 e a 5. Depois do 5 a sequência segue contando, sem novo selo.
export function streakMilestone(streak: number): StreakMilestone | undefined {
    return streak === 3 || streak === 5 ? streak : undefined
}
