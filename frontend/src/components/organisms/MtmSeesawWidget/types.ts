import type { MissionWidgetProps } from '../../../features/lessons/widgets/goal'
import type { MtmIndexer } from '../../../features/lessons/widgets/mtmMath'

export interface MtmSeesawWidgetProps extends MissionWidgetProps {
    contractRatePct: number
    yearsToMaturity: number
    indexer: MtmIndexer
    // Ponto de partida da taxa de mercado (missão e "Me mostra"); sem ele, começa na taxa contratada.
    marketRatePct?: number
}
