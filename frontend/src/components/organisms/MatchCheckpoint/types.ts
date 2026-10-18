import type { CheckpointView } from '../../../features/lessons/useCheckpoints'
import type { MatchBlock } from '../../../features/lessons/widgets/schema'

export interface MatchCheckpointProps {
    block: MatchBlock
    view: CheckpointView
    pending: boolean
    error: boolean
    isReview: boolean
    onSubmit: (response: { pair: [number, number] }) => void
}
