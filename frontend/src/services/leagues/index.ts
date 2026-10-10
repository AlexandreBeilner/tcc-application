import { apiRequest } from '../client'
import type { CreateLeagueParams, LeagueDetail, LeagueSummary } from './types'

export type {
    CreateLeagueParams,
    LeagueDetail,
    LeagueMemberStatus,
    LeagueStanding,
    LeagueSummary,
    LeagueWindow,
    PendingLeagueInvite,
} from './types'

export async function listLeagues(token: string): Promise<LeagueSummary[]> {
    const result = await apiRequest<{ leagues: LeagueSummary[] }>('/leagues', { token })
    return result.leagues
}

// Criar liga é capacidade PRO: sem plano ativo a resposta é `403 requer plano PRO`.
export async function createLeague(token: string, params: CreateLeagueParams): Promise<{ id: string }> {
    const result = await apiRequest<{ league: { id: string } }>('/leagues', { method: 'POST', body: params, token })
    return result.league
}

export function getLeague(token: string, id: string): Promise<LeagueDetail> {
    return apiRequest<LeagueDetail>(`/leagues/${id}`, { token })
}

export function renameLeague(token: string, id: string, name: string): Promise<void> {
    return apiRequest<void>(`/leagues/${id}`, { method: 'PATCH', body: { name }, token })
}

export function closeLeague(token: string, id: string): Promise<void> {
    return apiRequest<void>(`/leagues/${id}`, { method: 'DELETE', token })
}

export function inviteToLeague(token: string, id: string, userId: string): Promise<void> {
    return apiRequest<void>(`/leagues/${id}/invitations`, { method: 'POST', body: { userId }, token })
}

export function respondToLeagueInvitation(token: string, id: string, accept: boolean): Promise<void> {
    return apiRequest<void>(`/leagues/${id}/invitation`, { method: 'POST', body: { accept }, token })
}

export function leaveLeague(token: string, id: string): Promise<void> {
    return apiRequest<void>(`/leagues/${id}/leave`, { method: 'POST', token })
}

export function removeLeagueMember(token: string, id: string, userId: string): Promise<void> {
    return apiRequest<void>(`/leagues/${id}/members/${userId}`, { method: 'DELETE', token })
}
