import { apiRequest } from '../client'
import type { CosmeticKind, MyCosmetics } from './types'

export type { CosmeticItem, CosmeticKind, CosmeticSelection, MyCosmetics, PublicCosmetics } from './types'

// Sem cosmético nenhum: o que se mostra para quem não escolheu nada.
export const NO_COSMETICS = { frame: null, title: null } as const

export function getMyCosmetics(token: string): Promise<MyCosmetics> {
    return apiRequest<MyCosmetics>('/me/cosmetics', { token })
}

export function equipCosmetic(token: string, kind: CosmeticKind, itemKey: string): Promise<MyCosmetics> {
    return apiRequest<MyCosmetics>('/me/cosmetics', { method: 'PUT', body: { kind, itemKey }, token })
}

export function unequipCosmetic(token: string, kind: CosmeticKind): Promise<MyCosmetics> {
    return apiRequest<MyCosmetics>(`/me/cosmetics?kind=${kind}`, { method: 'DELETE', token })
}
