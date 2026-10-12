import type { PositionReturn } from '../../../features/portfolio/positionReturns'

export interface PositionsListProps {
    rows: PositionReturn[]
    onSelect: (row: PositionReturn) => void
}
