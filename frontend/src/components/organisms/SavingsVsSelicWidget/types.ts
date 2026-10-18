import type { MissionWidgetProps } from '../../../features/lessons/widgets/goal'

export interface SavingsVsSelicWidgetProps extends MissionWidgetProps {
    selicPct: number
    trMonthlyPct: number
    amount: number
    months: number
}
