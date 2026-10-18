import type { MissionWidgetProps } from '../../../features/lessons/widgets/goal'

export interface FeeDragWidgetProps extends MissionWidgetProps {
    initial: number
    monthly: number
    grossReturnPct: number
    feeAPct: number
    feeBPct: number
    years: number
}
