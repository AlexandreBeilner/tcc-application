import type { CheckpointView } from '../../../features/lessons/useCheckpoints'
import type { EstimateBlock } from '../../../features/lessons/widgets/schema'

export interface EstimateCheckpointProps {
    block: EstimateBlock
    view: CheckpointView
    pending: boolean
    error: boolean
    isReview: boolean
    onSubmit: (response: { value: number }) => void
}
