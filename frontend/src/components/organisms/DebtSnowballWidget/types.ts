import type { MissionWidgetProps } from '../../../features/lessons/widgets/goal'

export interface DebtSnowballWidgetProps extends MissionWidgetProps {
    balance: number
    monthlyRatePct: number
    payment: number
}
