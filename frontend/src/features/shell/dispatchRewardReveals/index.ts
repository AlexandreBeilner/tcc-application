import type { RewardRevealContent } from '../RewardRevealProvider'
import { achievementRevealContents } from '../achievementRewardReveal'
import { streakRevealContent } from '../streakRewardReveal'
import { xpRevealContent } from '../xpRewardReveal'
import type { RewardRevealSource } from './types'

export type { RewardRevealSource } from './types'

// Sequência fixa xp/level-up (I.3) -> conquistas (I.4) -> marco de streak
// (I.5) — extraído daqui porque `useAdvanceLesson`/`useCompleteMissionMutation`
// duplicavam o mesmo dispatch de 4 linhas (achado da revisão da PR 17);
// terceiro consumidor (tarefa 6.7, Calculadora) reaproveita isso em vez de
// copiar de novo.
export function dispatchRewardReveals(
    show: (content: RewardRevealContent) => void,
    result: RewardRevealSource,
): void {
    const reveal = xpRevealContent(result)
    if (reveal) show(reveal)
    achievementRevealContents(result).forEach(show)
    const streakReveal = streakRevealContent(result)
    if (streakReveal) show(streakReveal)
}
