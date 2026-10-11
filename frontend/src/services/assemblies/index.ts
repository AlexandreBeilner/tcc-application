import { apiRequest } from '../client'
import type { AssemblyDetail, AssemblyList, CastVoteResult, CompanyProposals, MyVotingStatus, ProposalSummary } from './types'

export type * from './types'

export interface ListAssembliesParams {
    status?: 'open' | 'closed'
    companyId?: string
    limit?: number
}

// Recurso desligado no servidor responde 404 (sem a chave `ASSEMBLIES_ENABLED`): quem chama trata.
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

// Votar e trocar o voto nunca exigem PRO: a regra (posição, crédito mensal) é do servidor.
export function castVote(token: string, id: string, optionId: string): Promise<CastVoteResult> {
    return apiRequest<CastVoteResult>(`/assemblies/${id}/vote`, { method: 'POST', body: { optionId }, token })
}

export function listCompanyProposals(token: string, companyId: string): Promise<CompanyProposals> {
    return apiRequest<CompanyProposals>(`/assemblies/companies/${companyId}/proposals`, { token })
}

// Propor e apoiar são capacidades PRO: sem plano a resposta é `403 requer plano PRO`.
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

// Retirar o apoio nunca exige PRO.
export function withdrawProposalSupport(token: string, proposalId: string): Promise<{ proposal: ProposalSummary; withdrawn: boolean }> {
    return apiRequest(`/assemblies/proposals/${proposalId}/support`, { method: 'DELETE', token })
}
