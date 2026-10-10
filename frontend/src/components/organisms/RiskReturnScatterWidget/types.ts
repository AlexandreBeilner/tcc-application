import type { ProductId } from '../../../features/lessons/widgets/riskMath'

export interface RiskReturnScatterWidgetProps {
    highlight: ProductId
    profile: 'none' | 'conservative' | 'moderate' | 'aggressive'
}
