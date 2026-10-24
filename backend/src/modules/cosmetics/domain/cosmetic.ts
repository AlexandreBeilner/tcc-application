import { NO_COSMETICS, type PublicCosmetics } from '../../../shared/publicCosmetics'

export { NO_COSMETICS }

export type CosmeticKind = 'frame' | 'title'

export const COSMETIC_KINDS: readonly CosmeticKind[] = ['frame', 'title']

export interface CosmeticItem {
  key: string
  kind: CosmeticKind
  name: string
  description: string
  sortOrder: number
  // Quantas indicações válidas liberam o item (MO.7.2). Ausente/nulo = livre pra todos.
  unlockReferrals?: number | null
}

// O que a pessoa escolheu em cada espaço (chaves de item).
export interface CosmeticSelection {
  frame: string | null
  title: string | null
}

export const EMPTY_SELECTION: CosmeticSelection = { frame: null, title: null }

export type CosmeticDisplay = PublicCosmetics

// O que os outros veem a partir da escolha. Item que saiu do catálogo some da vitrine.
export function resolveDisplay(
  selection: CosmeticSelection,
  catalog: readonly CosmeticItem[],
): CosmeticDisplay {
  const frame = catalog.find((item) => item.key === selection.frame && item.kind === 'frame')
  const title = catalog.find((item) => item.key === selection.title && item.kind === 'title')
  return { frame: frame?.key ?? null, title: title?.name ?? null }
}
