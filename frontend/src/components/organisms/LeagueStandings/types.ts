import type { LeagueStanding } from '../../../services/leagues'

export interface LeagueStandingsProps {
    standings: LeagueStanding[]
    // Só o dono passa isto: mostra o botão de tirar membro (nunca em si mesmo).
    onRemove?: (userId: string) => void
    removingId?: string | null
}
