import type { MissionWidgetProps } from '../../../features/lessons/widgets/goal'

export interface EquivalentRateWidgetProps extends MissionWidgetProps {
    exemptRatePct: number
    cdbRatePct: number
    daysPresets: number[]
}
