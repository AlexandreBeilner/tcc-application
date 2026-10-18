import type { MissionWidgetProps } from '../../../features/lessons/widgets/goal'

export interface FgcCoverageBarWidgetProps extends MissionWidgetProps {
    amountPerInstitution: number
    institutions: number
    sameConglomerate: boolean
    // Total fixo a distribuir (missão): ignora `amountPerInstitution` e divide o total pelo número de instituições.
    totalAmount?: number
}
