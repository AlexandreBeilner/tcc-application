import type { MissionWidgetProps } from '../../../features/lessons/widgets/goal'

export interface AllocationDonutWidgetProps extends MissionWidgetProps {
    profile: 'conservative' | 'moderate' | 'aggressive'
    amount: number
    // Pesos de partida (missão e "Me mostra"), em %, por cima do exemplo do perfil.
    postFixedPct?: number
    longerFixedPct?: number
    fiiPct?: number
    stocksPct?: number
}
