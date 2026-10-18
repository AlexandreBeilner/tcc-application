import type { CheckpointView } from '../../../features/lessons/useCheckpoints'
import type { CategorizeBlock } from '../../../features/lessons/widgets/schema'

export interface CategorizeCheckpointProps {
    block: CategorizeBlock
    view: CheckpointView
    pending: boolean
    error: boolean
    isReview: boolean
    onSubmit: (response: { groups: number[] }) => void
}
