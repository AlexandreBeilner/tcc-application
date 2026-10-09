import type { RateUnit } from '../../../features/calculator/computeGrowthProjection'

export interface CompoundGrowthWidgetProps {
    initial: number
    monthly: number
    ratePct: number
    rateUnit: RateUnit
    months: number
    showSimple: boolean
}
