import type { MissionWidgetProps } from '../../../features/lessons/widgets/goal'

export interface BudgetSplitWidgetProps extends MissionWidgetProps {
    income: number
    housing: number
    food: number
    transport: number
    leisure: number
    debts: number
    other: number
}
