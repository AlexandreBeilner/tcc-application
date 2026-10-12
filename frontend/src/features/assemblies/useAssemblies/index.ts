import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { UseQueryResult } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthContext'
import {
    castVote,
    getAssembly,
    getMyVotingStatus,
    listAssemblies,
    listCompanyProposals,
    proposeAgenda,
    supportProposal,
    withdrawProposalSupport,
} from '../../../services/assemblies'
import type { AssemblyDetail, AssemblyList, CompanyProposals, ListAssembliesParams, MyVotingStatus } from '../../../services/assemblies'
import { ApiError } from '../../../services/client'

export const ASSEMBLIES_QUERY_KEY = ['assemblies'] as const

// Placar ao vivo por polling curto (sem WebSocket): o servidor guarda 5 s em cache, então
// consultar um pouco mais devagar que isso já vê o placar andar.
export const SCOREBOARD_POLL_MS = 6_000

export function useAssembliesQuery(params: ListAssembliesParams = {}): UseQueryResult<AssemblyList> {
    const { token } = useAuth()
    return useQuery({
        queryKey: [...ASSEMBLIES_QUERY_KEY, 'list', params] as const,
        queryFn: () => listAssemblies(token as string, params),
        enabled: token !== null,
        retry: (count, error) => !isFeatureOff(error) && count < 2,
    })
}

// A Assembleia nasce ligada; só o desligamento de emergência (`ASSEMBLIES_ENABLED=off`) faz o
// servidor responder 404. Quem chama trata como "indisponível no momento", sem tela quebrada.
export function isFeatureOff(error: unknown): boolean {
    return error instanceof ApiError && error.status === 404
}

export function useAssemblyQuery(id: string): UseQueryResult<AssemblyDetail> {
    const { token } = useAuth()
    return useQuery({
        queryKey: [...ASSEMBLIES_QUERY_KEY, 'detail', id] as const,
        queryFn: () => getAssembly(token as string, id),
        enabled: token !== null,
        refetchInterval: (query) => (query.state.data?.assembly.status === 'open' ? SCOREBOARD_POLL_MS : false),
    })
}

export function useMyVotingStatusQuery(id: string, enabled: boolean): UseQueryResult<MyVotingStatus> {
    const { token } = useAuth()
    return useQuery({
        queryKey: [...ASSEMBLIES_QUERY_KEY, 'me', id] as const,
        queryFn: () => getMyVotingStatus(token as string, id),
        enabled: token !== null && enabled,
    })
}

export function useCastVoteMutation(assemblyId: string) {
    const { token } = useAuth()
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (optionId: string) => castVote(token as string, assemblyId, optionId),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ASSEMBLIES_QUERY_KEY }),
    })
}

export function useCompanyProposalsQuery(companyId: string, enabled = true): UseQueryResult<CompanyProposals> {
    const { token } = useAuth()
    return useQuery({
        queryKey: [...ASSEMBLIES_QUERY_KEY, 'proposals', companyId] as const,
        queryFn: () => listCompanyProposals(token as string, companyId),
        enabled: token !== null && enabled,
    })
}

function useProposalMutation<TVariables, TResult>(action: (token: string, variables: TVariables) => Promise<TResult>) {
    const { token } = useAuth()
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (variables: TVariables) => action(token as string, variables),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: [...ASSEMBLIES_QUERY_KEY, 'proposals'] }),
    })
}

export const useProposeAgendaMutation = (companyId: string) =>
    useProposalMutation((token, templateKey: string) => proposeAgenda(token, companyId, templateKey))
export const useSupportProposalMutation = () => useProposalMutation((token, proposalId: string) => supportProposal(token, proposalId))
export const useWithdrawSupportMutation = () =>
    useProposalMutation((token, proposalId: string) => withdrawProposalSupport(token, proposalId))
