import type { MissionWidgetProps } from '../../../features/lessons/widgets/goal'

export interface BondPriceCalculatorWidgetProps extends MissionWidgetProps {
    ratePct: number
    years: number
    amount: number
}
