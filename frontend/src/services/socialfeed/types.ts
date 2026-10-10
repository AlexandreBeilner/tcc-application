import type { PublicCosmetics } from '../cosmetics'
// Espelha `.docs/backend/socialfeed.md` (`GET /social-feed`). `type` é
// texto livre no backend (não enum) pra caber tipo futuro sem migration
// nova — `'track_completed'`, `'duel_won'` e `'duel_draw'` (MO.5.3). `trackNumber` é só o número
// (`0`–`3`); nome/cor da trilha é constante estática no frontend (mesma
// decisão de `TrackTrophyCase`, F.3), o backend nunca devolve `trackName`.
// Nenhum campo de patrimônio/rentabilidade/XP absoluto (RNF09).
export interface SocialFeedEvent {
    type: 'track_completed' | 'duel_won' | 'duel_draw'
    trackNumber: number | null
    // Resultado de duelo (MO.5.3); `null` em `track_completed`. Só nomes e desfecho, nunca
    // percentual nem patrimônio. O feed celebra: quem perdeu nunca vira item.
    duel: {
        duelId: string
        opponentUsername: string
        opponentName: string
        reason: 'profitability' | 'abandonment' | 'tie' | 'both_inactive'
    } | null
    occurredAt: string
    userId: string
    username: string
    name: string
    avatarUrl: string | null
    cosmetics: PublicCosmetics
}

export interface GetSocialFeedResult {
    events: SocialFeedEvent[]
}
