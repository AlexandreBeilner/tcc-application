import type { CheckpointView } from '../../../features/lessons/useCheckpoints'
import type { ChoiceBlock } from '../../../features/lessons/widgets/schema'

export interface ChoiceCheckpointProps {
    block: ChoiceBlock
    view: CheckpointView
    pending: boolean
    error: boolean
    // Em revisão (sem estado) a resposta certa não trava nada; só muda o texto do selo.
    isReview: boolean
    onSubmit: (response: { selectedOption: number }) => void
}
