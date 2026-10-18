import type { CheckpointResponse, CheckpointView } from '../../../features/lessons/useCheckpoints'
import type { CheckBlock } from '../../../features/lessons/widgets/schema'

export interface LessonCheckpointProps {
    block: CheckBlock
    view: CheckpointView
    pending: boolean
    error: boolean
    // Em revisão (sem estado) a resposta certa não trava nada; só muda o texto do selo.
    isReview: boolean
    onSubmit: (response: CheckpointResponse) => void
}
