import type { MtmIndexer } from '../../../features/lessons/widgets/mtmMath'

export interface MtmSeesawWidgetProps {
    contractRatePct: number
    yearsToMaturity: number
    indexer: MtmIndexer
}
