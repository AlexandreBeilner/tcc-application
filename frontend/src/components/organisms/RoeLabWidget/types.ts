import type { MissionWidgetProps } from '../../../features/lessons/widgets/goal'

export interface RoeLabWidgetProps extends MissionWidgetProps {
    revenue: number
    netIncome: number
    assets: number
    equity: number
    selicPct: number
}
