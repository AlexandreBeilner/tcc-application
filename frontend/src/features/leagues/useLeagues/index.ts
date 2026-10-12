import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthContext'
import {
    closeLeague,
    createLeague,
    getLeague,
    inviteToLeague,
    leaveLeague,
    listLeagues,
    removeLeagueMember,
    renameLeague,
    respondToLeagueInvitation,
} from '../../../services/leagues'
import type { CreateLeagueParams, LeagueDetail, LeagueSummary } from '../../../services/leagues'

export const LEAGUES_QUERY_KEY = ['leagues'] as const

// Ligas da própria conta (MO.5.2): as que participa e os convites pendentes.
export function useLeaguesQuery(): UseQueryResult<LeagueSummary[]> {
    const { token } = useAuth()
    return useQuery({
        queryKey: [...LEAGUES_QUERY_KEY, 'list'] as const,
        queryFn: () => listLeagues(token as string),
        enabled: token !== null,
    })
}

export function useLeagueQuery(id: string): UseQueryResult<LeagueDetail> {
    const { token } = useAuth()
    return useQuery({
        queryKey: [...LEAGUES_QUERY_KEY, 'detail', id] as const,
        queryFn: () => getLeague(token as string, id),
        enabled: token !== null,
    })
}

// Toda ação sobre ligas refaz as leituras de ligas (lista e detalhe).
function useLeagueMutation<TVariables, TResult = void>(
    action: (token: string, variables: TVariables) => Promise<TResult>,
): UseMutationResult<TResult, unknown, TVariables> {
    const { token } = useAuth()
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (variables: TVariables) => action(token as string, variables),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: LEAGUES_QUERY_KEY }),
    })
}

export const useCreateLeagueMutation = () => useLeagueMutation((token, params: CreateLeagueParams) => createLeague(token, params))
export const useRenameLeagueMutation = () =>
    useLeagueMutation((token, v: { id: string; name: string }) => renameLeague(token, v.id, v.name))
export const useCloseLeagueMutation = () => useLeagueMutation((token, id: string) => closeLeague(token, id))
export const useInviteToLeagueMutation = () =>
    useLeagueMutation((token, v: { id: string; userId: string }) => inviteToLeague(token, v.id, v.userId))
export const useRespondToLeagueInvitationMutation = () =>
    useLeagueMutation((token, v: { id: string; accept: boolean }) => respondToLeagueInvitation(token, v.id, v.accept))
export const useLeaveLeagueMutation = () => useLeagueMutation((token, id: string) => leaveLeague(token, id))
export const useRemoveLeagueMemberMutation = () =>
    useLeagueMutation((token, v: { id: string; userId: string }) => removeLeagueMember(token, v.id, v.userId))
