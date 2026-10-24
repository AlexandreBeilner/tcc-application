import { apiRequest } from '../client'
import type { Retrospective } from './types'

export type { Retrospective } from './types'

// Meses com retrospectiva (fechados), mais recentes primeiro.
export async function listRetrospectiveMonths(token: string): Promise<string[]> {
    const result = await apiRequest<{ months: string[] }>('/retrospectives', { token })
    return result.months
}

export async function getRetrospective(token: string, month: string): Promise<Retrospective> {
    const result = await apiRequest<{ retrospective: Retrospective }>(`/retrospectives/${month}`, { token })
    return result.retrospective
}
