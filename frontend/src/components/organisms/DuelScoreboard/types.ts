import type { Duel } from '../../../services/duels'

export interface DuelScoreboardProps {
    duel: Duel
    // Quem está olhando (para mostrar o próprio lado com a própria moldura).
    you: { username: string; avatarUrl: string | null; frame: string | null }
}
