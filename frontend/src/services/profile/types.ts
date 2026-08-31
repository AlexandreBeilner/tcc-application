// Espelha `.docs/backend/profile.md` (`GET /users/:id/profile`, mesma
// forma de `GET /me/profile` — tarefa 6.10, não implementado ainda).
import type { RankingWindow } from '../ranking'

export type { RankingWindow } from '../ranking'

export interface PublicProfileAchievement {
    id: string
    name: string
    description: string | null
    unlockedAt: string
}

export interface PublicProfile {
    username: string
    level: number
    xp: number
    currentStreak: number
    achievements: PublicProfileAchievement[]
    // Sempre critério `overall` (`GetPublicProfileUseCase` não aceita outro)
    // — nunca `null` (baseline de `overall` nunca é legitimamente 0, RNF06,
    // `.docs/backend/ranking.md`), diferente de `RankingEntry.profitabilityPct`.
    profitabilityPct: number
    window: RankingWindow
}

export interface GetUserProfileParams {
    window?: RankingWindow
}
