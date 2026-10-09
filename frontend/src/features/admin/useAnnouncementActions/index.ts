import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { UseMutationResult } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthContext'
import { createAnnouncement, endAnnouncement, startMaintenance, updateAnnouncement } from '../../../services/admin'
import type {
    AdminAnnouncement,
    AnnouncementInput,
    AnnouncementPatch,
    EndAnnouncementResult,
    MaintenanceInput,
} from '../../../services/admin'
import { ACTIVE_ANNOUNCEMENTS_QUERY_KEY } from '../../announcements/useActiveAnnouncements'
import { TRADING_HALTS_QUERY_KEY } from '../../market/useTradingHaltQuery'
import { useAdminReauth } from '../AdminReauth'
import { ADMIN_ANNOUNCEMENTS_QUERY_KEY } from '../useAdminAnnouncementsQuery'
import { AUDIT_LOG_QUERY_KEY } from '../useAuditLogQuery'
import { TRADING_HALTS_ADMIN_QUERY_KEY } from '../useTradingHaltsQuery'

// Qualquer mudança de comunicado muda a lista do painel, a faixa do usuário e a auditoria; a
// manutenção (abrir ou encerrar) pode também abrir ou levantar a pausa de negociação.
// Invalida no `onSettled`: um 409 também deixa a lista velha.
function useInvalidateAnnouncementQueries() {
    const queryClient = useQueryClient()
    return () => {
        queryClient.invalidateQueries({ queryKey: ADMIN_ANNOUNCEMENTS_QUERY_KEY })
        queryClient.invalidateQueries({ queryKey: ACTIVE_ANNOUNCEMENTS_QUERY_KEY })
        queryClient.invalidateQueries({ queryKey: AUDIT_LOG_QUERY_KEY })
        queryClient.invalidateQueries({ queryKey: TRADING_HALTS_ADMIN_QUERY_KEY })
        queryClient.invalidateQueries({ queryKey: TRADING_HALTS_QUERY_KEY })
    }
}

export function useCreateAnnouncementMutation(): UseMutationResult<AdminAnnouncement, unknown, AnnouncementInput> {
    const { token } = useAuth()
    const invalidate = useInvalidateAnnouncementQueries()

    return useMutation({
        mutationFn: (input: AnnouncementInput) => createAnnouncement(token as string, input),
        onSettled: invalidate,
    })
}

export function useUpdateAnnouncementMutation(): UseMutationResult<AdminAnnouncement, unknown, { id: string; patch: AnnouncementPatch }> {
    const { token } = useAuth()
    const invalidate = useInvalidateAnnouncementQueries()

    return useMutation({
        mutationFn: ({ id, patch }) => updateAnnouncement(token as string, id, patch),
        onSettled: invalidate,
    })
}

export function useEndAnnouncementMutation(): UseMutationResult<EndAnnouncementResult, unknown, string> {
    const { token } = useAuth()
    const invalidate = useInvalidateAnnouncementQueries()

    return useMutation({
        mutationFn: (id: string) => endAnnouncement(token as string, id),
        onSettled: invalidate,
    })
}

// Com `pause_trading` o backend pede senha recente (`reauth_required`): passa por `withReauth`.
export function useStartMaintenanceMutation(): UseMutationResult<AdminAnnouncement, unknown, MaintenanceInput> {
    const { withReauth } = useAdminReauth()
    const invalidate = useInvalidateAnnouncementQueries()

    return useMutation({
        mutationFn: (input: MaintenanceInput) => withReauth((t) => startMaintenance(t, input)),
        onSettled: invalidate,
    })
}
