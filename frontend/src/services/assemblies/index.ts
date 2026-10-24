import { apiRequest } from '../client'
import type { AssemblyDetail, AssemblyList, CastVoteResult, CompanyProposals, MyVotingStatus, ProposalSummary } from './types'

export type * from './types'

export interface ListAssembliesParams {
    status?: 'open' | 'closed'
    companyId?: string
    limit?: number
}

// Recurso desligado de emergência no servidor (`ASSEMBLIES_ENABLED=off`) responde 404: quem chama trata.
export function listAssemblies(token: string, params: ListAssembliesParams = {}): Promise<AssemblyList> {
    const query = new URLSearchParams()
    if (params.status) query.set('status', params.status)
    if (params.companyId) query.set('companyId', params.companyId)
    if (params.limit) query.set('limit', String(params.limit))
    const qs = query.toString()
    return apiRequest<AssemblyList>(`/assemblies${qs ? `?${qs}` : ''}`, { token })
}

export function getAssembly(token: string, id: string): Promise<AssemblyDetail> {
    return apiRequest<AssemblyDetail>(`/assemblies/${id}`, { token })
}

export function getMyVotingStatus(token: string, id: string): Promise<MyVotingStatus> {
    return apiRequest<MyVotingStatus>(`/assemblies/${id}/me`, { token })
}

// Votar e trocar o voto: a regra (posição na data de corte) é do servidor.
export function castVote(token: string, id: string, optionId: string): Promise<CastVoteResult> {
    return apiRequest<CastVoteResult>(`/assemblies/${id}/vote`, { method: 'POST', body: { optionId }, token })
}

export function listCompanyProposals(token: string, companyId: string): Promise<CompanyProposals> {
    return apiRequest<CompanyProposals>(`/assemblies/companies/${companyId}/proposals`, { token })
}

export function proposeAgenda(
    token: string,
    companyId: string,
    templateKey: string,
): Promise<{ proposal: ProposalSummary; joinedExisting: boolean }> {
    return apiRequest(`/assemblies/companies/${companyId}/proposals`, { method: 'POST', body: { templateKey }, token })
}

export function supportProposal(token: string, proposalId: string): Promise<{ proposal: ProposalSummary; alreadySupported: boolean }> {
    return apiRequest(`/assemblies/proposals/${proposalId}/support`, { method: 'PUT', token })
}

export function withdrawProposalSupport(token: string, proposalId: string): Promise<{ proposal: ProposalSummary; withdrawn: boolean }> {
    return apiRequest(`/assemblies/proposals/${proposalId}/support`, { method: 'DELETE', token })
}
