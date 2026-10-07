import type { IncomeType } from '../../../features/lessons/widgets/emergencyMath'

export interface EmergencyFundCalculatorWidgetProps {
    monthlyCost: number
    incomeType: IncomeType
    monthlyContribution: number
}
