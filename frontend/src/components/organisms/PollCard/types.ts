import type { PollState } from '../../../services/lessons'
import type { PollBlock } from '../../../features/lessons/widgets/schema'

export interface PollCardProps {
    block: PollBlock
    // Ausente enquanto a pessoa não votou: o resultado só aparece depois do voto.
    state: PollState | undefined
    pending: boolean
    error: boolean
    onVote: (option: number) => void
}
