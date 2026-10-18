import type { CheckpointView } from '../../../features/lessons/useCheckpoints'
import type { OrderBlock } from '../../../features/lessons/widgets/schema'

export interface OrderCheckpointProps {
    block: OrderBlock
    view: CheckpointView
    pending: boolean
    error: boolean
    isReview: boolean
    onSubmit: (response: { sequence: number[] }) => void
}
