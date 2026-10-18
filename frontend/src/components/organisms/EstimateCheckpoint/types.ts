import type { CheckpointView } from '../../../features/lessons/useCheckpoints'
import type { EstimateBlock } from '../../../features/lessons/widgets/schema'

export interface EstimateCheckpointProps {
    block: EstimateBlock
    view: CheckpointView
    pending: boolean
    error: boolean
    isReview: boolean
    // Nome da lição, para o cartão de compartilhar o chute (LJ.5.10).
    lessonTitle?: string
    onSubmit: (response: { value: number }) => void
}
