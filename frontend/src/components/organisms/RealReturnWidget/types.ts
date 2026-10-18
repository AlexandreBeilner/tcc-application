import type { MissionWidgetProps } from '../../../features/lessons/widgets/goal'

export interface RealReturnWidgetProps extends MissionWidgetProps {
    nominalPct: number
    inflationPct: number
    amount: number
}
