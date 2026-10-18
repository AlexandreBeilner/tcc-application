import type { MissionWidgetProps } from '../../../features/lessons/widgets/goal'

export interface BreakevenInflationWidgetProps extends MissionWidgetProps {
    prefixedPct: number
    realPct: number
    expectedInflationPct: number
}
