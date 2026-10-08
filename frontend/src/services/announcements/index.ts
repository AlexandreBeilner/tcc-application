import { apiRequest } from '../client'
import type { ActiveAnnouncement } from './types'

export type { ActiveAnnouncement } from './types'

// Comunicados no ar agora (N.20): a faixa do topo do app.
export function listActiveAnnouncements(token: string): Promise<{ announcements: ActiveAnnouncement[] }> {
    return apiRequest<{ announcements: ActiveAnnouncement[] }>('/announcements', { token })
}
