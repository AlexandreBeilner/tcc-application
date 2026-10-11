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
  // Quantas indicações válidas liberam o item (MO.7.2). Ausente/nulo = livre pra todo PRO.
  unlockReferrals?: number | null
}

// O que a pessoa escolheu em cada espaço (chaves de item), independente de ser PRO agora.
export interface CosmeticSelection {
  frame: string | null
  title: string | null
}

export const EMPTY_SELECTION: CosmeticSelection = { frame: null, title: null }

export type CosmeticDisplay = PublicCosmetics

// Regra de arquivamento: a escolha fica guardada, mas só aparece enquanto a pessoa é PRO. Assim
// cancelar "desequipa" para os outros sem apagar nada, e reativar restaura sozinho. Nunca depende
// de escrever no banco no momento do cancelamento. Item que saiu do catálogo some da vitrine.
export function resolveDisplay(
  isPro: boolean,
  selection: CosmeticSelection,
  catalog: readonly CosmeticItem[],
): CosmeticDisplay {
  if (!isPro) return NO_COSMETICS
  const frame = catalog.find((item) => item.key === selection.frame && item.kind === 'frame')
  const title = catalog.find((item) => item.key === selection.title && item.kind === 'title')
  return { isPro: true, frame: frame?.key ?? null, title: title?.name ?? null }
}
