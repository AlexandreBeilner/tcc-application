import type { MissionWidgetProps } from '../../../features/lessons/widgets/goal'
import type { IncomeType } from '../../../features/lessons/widgets/emergencyMath'

export interface EmergencyFundCalculatorWidgetProps extends MissionWidgetProps {
    monthlyCost: number
    incomeType: IncomeType
    monthlyContribution: number
}
