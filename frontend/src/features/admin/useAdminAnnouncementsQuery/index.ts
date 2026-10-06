import { useQuery } from '@tanstack/react-query'
import type { UseQueryResult } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthContext'
import { listAdminAnnouncements } from '../../../services/admin'
import type { AdminAnnouncement } from '../../../services/admin'

export const ADMIN_ANNOUNCEMENTS_QUERY_KEY = ['admin', 'announcements'] as const

export function useAdminAnnouncementsQuery(): UseQueryResult<AdminAnnouncement[]> {
    const { token } = useAuth()

    return useQuery({
        queryKey: ADMIN_ANNOUNCEMENTS_QUERY_KEY,
        queryFn: async () => (await listAdminAnnouncements(token as string)).announcements,
        enabled: token !== null,
        refetchInterval: 30_000,
    })
}
