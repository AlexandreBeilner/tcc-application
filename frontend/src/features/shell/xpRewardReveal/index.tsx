import { Sparkles, TrendingUp } from 'lucide-react'
import type { RewardRevealContent } from '../RewardRevealProvider'
import type { XpRewardSource } from './types'

export type { XpRewardSource } from './types'

// Tarefa I.3: decide o conteúdo do `RewardReveal` (I.1) pra uma resposta de
// mutação que credita xp (`useAdvanceLesson`, `useCompleteMissionMutation`)
// — `null` quando não há nada a mostrar (`xpAwarded` ausente, ex: reabrir
// lição já concluída ou missão já concluída no dia, `.docs/backend/lessons.md`/
// `missions.md`). `leveledUp` tem prioridade e suprime o reveal de XP —
// critério de aceite explícito da tarefa: "um ganho que cruza um limiar de
// nível mostra só o reveal de level-up", nunca os dois empilhados.
export function xpRevealContent(result: XpRewardSource): RewardRevealContent | null {
    if (result.leveledUp) {
        return {
            icon: <TrendingUp size={22} strokeWidth={2.2} />,
            title: 'Você subiu de nível!',
        }
    }
    if (result.xpAwarded !== undefined) {
        return {
            icon: <Sparkles size={22} strokeWidth={2.2} />,
            title: `+${result.xpAwarded} XP`,
        }
    }
    return null
}
