// Espelha `.docs/backend/duels.md`.
import type { PublicCosmetics } from '../cosmetics'

export type DuelStatus = 'pending' | 'active' | 'finished' | 'declined' | 'cancelled' | 'expired'
export type DuelResult = 'won' | 'lost' | 'draw'
export type DuelReason = 'profitability' | 'abandonment' | 'tie' | 'both_inactive'

export interface DuelPlayerScore {
    // Só percentual do período (RNF09).
    returnPct: number
    operated: boolean
}

export interface DuelOpponent {
    id: string
    username: string
    name: string
    avatarUrl: string | null
    cosmetics: PublicCosmetics
}

export interface Duel {
    id: string
    status: DuelStatus
    // Papel de quem olha.
    role: 'challenger' | 'opponent'
    opponent: DuelOpponent
    createdAt: string
    expiresAt: string
    startsAt: string | null
    endsAt: string | null
    finishedAt: string | null
    result: DuelResult | null
    reason: DuelReason | null
    // Placar gravado (encerrado) ou parcial ao vivo (no detalhe de um duelo em andamento).
    you: DuelPlayerScore | null
    them: DuelPlayerScore | null
}
