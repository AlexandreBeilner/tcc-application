import type { ResultCardData } from '../../../features/lessons/shareResult'

export interface ShareResultButtonProps {
    // Mensagem sem o link; o link de convite da pessoa é acrescentado no envio.
    message: string
    card: ResultCardData
}
