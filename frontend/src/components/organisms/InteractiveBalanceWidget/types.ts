import type { MissionWidgetProps } from '../../../features/lessons/widgets/goal'

export interface InteractiveBalanceWidgetProps extends MissionWidgetProps {
    netRevenue: number
    costsPct: number
    expensesPct: number
    financialResult: number
    taxPct: number
    cash: number
    fixedAssets: number
    debt: number
    otherLiabilities: number
}
