import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { UseQueryResult } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthContext'
import { listAuditLog } from '../../../services/admin'
import type { AuditAction, AuditLogEntry, AuditResult } from '../../../services/admin'

export const AUDIT_LOG_PAGE_SIZE = 20

export const AUDIT_LOG_QUERY_KEY = ['admin', 'audit-log'] as const

export interface AuditLogQueryFilters {
    action?: AuditAction
    result?: AuditResult
    from?: string
    to?: string
}

export interface AuditLogPage {
    entries: AuditLogEntry[]
    page: number
    totalEntries: number
    totalPages: number
}

// `placeholderData: keepPreviousData` mantém a lista anterior na tela
// enquanto o filtro ou a página nova carrega (sem piscar "carregando").
export function useAuditLogQuery(filters: AuditLogQueryFilters, page: number): UseQueryResult<AuditLogPage> {
    const { token } = useAuth()

    return useQuery({
        queryKey: [...AUDIT_LOG_QUERY_KEY, filters, page] as const,
        queryFn: async () => {
            const result = await listAuditLog(token as string, {
                ...filters,
                limit: AUDIT_LOG_PAGE_SIZE,
                offset: (page - 1) * AUDIT_LOG_PAGE_SIZE,
            })
            return {
                entries: result.entries,
                page,
                totalEntries: result.total_entries,
                totalPages: Math.max(1, Math.ceil(result.total_entries / AUDIT_LOG_PAGE_SIZE)),
            }
        },
        enabled: token !== null,
        placeholderData: keepPreviousData,
    })
}
