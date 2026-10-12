import { apiRequest } from '../client'
import type { CosmeticKind, MyCosmetics } from './types'

export type { CosmeticItem, CosmeticKind, CosmeticSelection, MyCosmetics, PublicCosmetics } from './types'

// Sem cosmético nenhum: o que se mostra para quem não é PRO.
export const NO_COSMETICS = { isPro: false, frame: null, title: null } as const

export function getMyCosmetics(token: string): Promise<MyCosmetics> {
    return apiRequest<MyCosmetics>('/me/cosmetics', { token })
}

// Equipar é capacidade PRO: sem plano ativo a resposta é `403 requer plano PRO`.
export function equipCosmetic(token: string, kind: CosmeticKind, itemKey: string): Promise<MyCosmetics> {
    return apiRequest<MyCosmetics>('/me/cosmetics', { method: 'PUT', body: { kind, itemKey }, token })
}

export function unequipCosmetic(token: string, kind: CosmeticKind): Promise<MyCosmetics> {
    return apiRequest<MyCosmetics>(`/me/cosmetics?kind=${kind}`, { method: 'DELETE', token })
}
