import type { PendingLeagueInvite } from '../../../services/leagues'

export interface LeagueInvitePanelProps {
    leagueId: string
    // Quem já está na liga ou já foi convidado: não aparece como opção.
    takenUserIds: string[]
    pendingInvites: PendingLeagueInvite[]
    onCancelInvite: (userId: string) => void
}
