// Espelha `.docs/backend/leagues.md`.
import type { PublicCosmetics } from '../cosmetics'

export type LeagueWindow = 'week' | 'month'
export type LeagueMemberStatus = 'invited' | 'active'

export interface LeagueSummary {
    id: string
    name: string
    window: LeagueWindow
    ownerId: string
    ownerUsername: string
    isOwner: boolean
    // `invited` = convite pendente para a pessoa; `active` = participa.
    status: LeagueMemberStatus
    memberCount: number
}

export interface LeagueStanding {
    position: number
    userId: string
    username: string
    name: string
    avatarUrl: string | null
    level: number
    // Só percentual do período (RNF09). `null` quando não deu para calcular agora.
    profitabilityPct: number | null
    isYou: boolean
    cosmetics: PublicCosmetics
}

export interface PendingLeagueInvite {
    userId: string
    username: string
}

export interface LeagueDetail {
    league: LeagueSummary
    standings: LeagueStanding[]
    pendingInvites: PendingLeagueInvite[]
    updatedAt: string | null
}

export interface CreateLeagueParams {
    name: string
    window: LeagueWindow
}
