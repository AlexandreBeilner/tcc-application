import type { CheckpointResponse, CheckpointView } from '../../../features/lessons/useCheckpoints'
import type { CheckBlock } from '../../../features/lessons/widgets/schema'

export interface LessonCheckpointProps {
    block: CheckBlock
    view: CheckpointView
    pending: boolean
    error: boolean
    // Em revisão (sem estado) a resposta certa não trava nada; só muda o texto do selo.
    isReview: boolean
    // Nome da lição; só a estimativa usa (cartão de compartilhar o chute, LJ.5.10).
    lessonTitle?: string
    onSubmit: (response: CheckpointResponse) => void
}
