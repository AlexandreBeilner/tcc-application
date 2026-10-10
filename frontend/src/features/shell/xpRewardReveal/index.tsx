import { Sparkles, TrendingUp } from 'lucide-react'
import { formatCurrency } from '../../portfolio/format'
import type { RewardRevealContent } from '../RewardRevealProvider'
import type { XpRewardSource } from './types'

export type { XpRewardSource } from './types'

// Fórmula em degraus do salário mensal simulado (Fase T) — cópia da função
// pura do backend (`backend/src/modules/payroll/domain/salary.ts`, fonte
// real ali, ver T.3); duplicada aqui porque frontend/backend não
// compartilham código TS (mesmo tipo de duplicação entre runtimes já
// aceito na Fase S/T.6, lá entre Go e Node) — o reveal de level-up (T.10)
// precisa do valor em tempo real, sem round-trip extra pro backend.
function monthlySalaryForLevel(level: number): number {
    const tier = Math.ceil(level / 10)
    const fullTiersSum = (1000 * (tier - 1) * tier) / 2
    const levelsIntoTier = level - 10 * (tier - 1)
    return fullTiersSum + 100 * tier * levelsIntoTier
}

// Diferença de salário mensal entre o nível novo e o anterior — nível 1 (sem
// nível anterior de verdade) trata o "antes" como nível 0, que a fórmula já
// resolve pra R$0 (tier 0), então a mensagem sempre soma corretamente sem
// caso especial.
function describeSalaryChange(newLevel: number): string {
    const current = monthlySalaryForLevel(newLevel)
    const previous = monthlySalaryForLevel(newLevel - 1)
    return `Salário mensal agora é ${formatCurrency(current)} (+${formatCurrency(current - previous)})`
}

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
            description: result.newLevel !== undefined ? describeSalaryChange(result.newLevel) : undefined,
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
