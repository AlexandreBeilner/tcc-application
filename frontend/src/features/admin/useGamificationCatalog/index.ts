import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query'
import {
    createAchievement,
    getAchievementCatalog,
    getAdminRanking,
    getMissionCatalog,
    updateAchievement,
    updateMission,
} from '../../../services/admin'
import type {
    AchievementCatalog,
    AdminRanking,
    AdminRankingFilters,
    CatalogAchievement,
    CatalogMission,
    CreateAchievementInput,
    UpdateAchievementInput,
    UpdateMissionInput,
} from '../../../services/admin'
import { useAuth } from '../../auth/AuthContext'
import { AUDIT_LOG_QUERY_KEY } from '../useAuditLogQuery'

export const ACHIEVEMENT_CATALOG_QUERY_KEY = ['admin', 'gamification', 'achievements'] as const
export const MISSION_CATALOG_QUERY_KEY = ['admin', 'gamification', 'missions'] as const
export const ADMIN_RANKING_QUERY_KEY = ['admin', 'gamification', 'ranking'] as const

// Catálogo muda só quando o admin edita: sem polling.
export function useAchievementCatalogQuery(): UseQueryResult<AchievementCatalog> {
    const { token } = useAuth()
    return useQuery({
        queryKey: ACHIEVEMENT_CATALOG_QUERY_KEY,
        queryFn: () => getAchievementCatalog(token as string),
        enabled: token !== null,
        retry: false,
    })
}

export function useMissionCatalogQuery(): UseQueryResult<CatalogMission[]> {
    const { token } = useAuth()
    return useQuery({
        queryKey: MISSION_CATALOG_QUERY_KEY,
        queryFn: async () => (await getMissionCatalog(token as string)).missions,
        enabled: token !== null,
        retry: false,
    })
}

// O ranking é calculado na hora (custa chamadas ao motor por usuário): só carrega quando a aba é aberta
// (`enabled`) e mantém a página anterior na tela enquanto troca de filtro.
export function useAdminRankingQuery(filters: AdminRankingFilters, enabled: boolean): UseQueryResult<AdminRanking> {
    const { token } = useAuth()
    return useQuery({
        queryKey: [...ADMIN_RANKING_QUERY_KEY, filters] as const,
        queryFn: () => getAdminRanking(token as string, filters),
        enabled: enabled && token !== null,
        placeholderData: keepPreviousData,
        retry: false,
    })
}

function useInvalidateCatalogQueries(key: readonly string[]) {
    const queryClient = useQueryClient()
    return () => {
        queryClient.invalidateQueries({ queryKey: key })
        queryClient.invalidateQueries({ queryKey: AUDIT_LOG_QUERY_KEY })
    }
}

export function useCreateAchievementMutation(): UseMutationResult<CatalogAchievement, unknown, CreateAchievementInput> {
    const { token } = useAuth()
    const invalidate = useInvalidateCatalogQueries(ACHIEVEMENT_CATALOG_QUERY_KEY)
    return useMutation({
        mutationFn: (input: CreateAchievementInput) => createAchievement(token as string, input),
        onSettled: invalidate,
    })
}

export interface UpdateAchievementVariables {
    id: string
    changes: UpdateAchievementInput
}

export function useUpdateAchievementMutation(): UseMutationResult<CatalogAchievement, unknown, UpdateAchievementVariables> {
    const { token } = useAuth()
    const invalidate = useInvalidateCatalogQueries(ACHIEVEMENT_CATALOG_QUERY_KEY)
    return useMutation({
        mutationFn: ({ id, changes }: UpdateAchievementVariables) => updateAchievement(token as string, id, changes),
        onSettled: invalidate,
    })
}

export interface UpdateMissionVariables {
    id: string
    changes: UpdateMissionInput
}

export function useUpdateMissionMutation(): UseMutationResult<CatalogMission, unknown, UpdateMissionVariables> {
    const { token } = useAuth()
    const invalidate = useInvalidateCatalogQueries(MISSION_CATALOG_QUERY_KEY)
    return useMutation({
        mutationFn: ({ id, changes }: UpdateMissionVariables) => updateMission(token as string, id, changes),
        onSettled: invalidate,
    })
}
