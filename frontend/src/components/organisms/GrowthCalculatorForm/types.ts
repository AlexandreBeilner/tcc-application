import type { MissionWidgetProps } from '../../../features/lessons/widgets/goal'

// Valores iniciais opcionais (missão da lição, LJ.3.1); sem eles a calculadora nasce em branco.
export interface GrowthCalculatorFormProps extends MissionWidgetProps {
    initialCapital?: number
    monthlyContribution?: number
    // Taxa ao ano.
    ratePct?: number
    periodYears?: number
}
