// Espelha `.docs/backend/socialfeed.md` (`GET /social-feed`). `type` é
// texto livre no backend (não enum) pra caber tipo futuro sem migration
// nova — só `'track_completed'` existe hoje. `trackNumber` é só o número
// (`0`–`3`); nome/cor da trilha é constante estática no frontend (mesma
// decisão de `TrackTrophyCase`, F.3), o backend nunca devolve `trackName`.
// Nenhum campo de patrimônio/rentabilidade/XP absoluto (RNF09).
export interface SocialFeedEvent {
    type: 'track_completed'
    trackNumber: number | null
    occurredAt: string
    userId: string
    username: string
    name: string
    avatarUrl: string | null
}

export interface GetSocialFeedResult {
    events: SocialFeedEvent[]
}
