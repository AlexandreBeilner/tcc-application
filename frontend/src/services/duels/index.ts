import { apiRequest } from '../client'
import type { Duel } from './types'

export type { Duel, DuelOpponent, DuelPlayerScore, DuelReason, DuelResult, DuelStatus } from './types'

export async function listDuels(token: string): Promise<Duel[]> {
    const result = await apiRequest<{ duels: Duel[] }>('/duels', { token })
    return result.duels
}

export async function getDuel(token: string, id: string): Promise<Duel> {
    const result = await apiRequest<{ duel: Duel }>(`/duels/${id}`, { token })
    return result.duel
}

// Desafiar é capacidade PRO: sem plano ativo a resposta é `403 requer plano PRO`.
export async function createDuel(token: string, opponentId: string): Promise<Duel> {
    const result = await apiRequest<{ duel: Duel }>('/duels', { method: 'POST', body: { opponentId }, token })
    return result.duel
}

// Aceitar ou recusar nunca exige PRO.
export function respondToDuel(token: string, id: string, accept: boolean): Promise<void> {
    return apiRequest<void>(`/duels/${id}/response`, { method: 'POST', body: { accept }, token })
}

export function cancelDuel(token: string, id: string): Promise<void> {
    return apiRequest<void>(`/duels/${id}`, { method: 'DELETE', token })
}
