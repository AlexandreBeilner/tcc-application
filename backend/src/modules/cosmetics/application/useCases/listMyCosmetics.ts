import type { CosmeticItem, CosmeticSelection } from '../../domain/cosmetic'
import { resolveDisplay, type CosmeticDisplay } from '../../domain/cosmetic'
import type { CosmeticCatalogRepository } from '../ports/cosmeticCatalogRepository'
import type { CosmeticSelectionRepository } from '../ports/cosmeticSelectionRepository'
import type { ReferralUnlocks } from '../ports/referralUnlocks'

export interface MyCosmetics {
  catalog: CosmeticItem[]
  // Indicações válidas da pessoa: itens com `unlockReferrals` maior que isto aparecem bloqueados.
  referralCount: number
  // O que a pessoa escolheu.
  selection: CosmeticSelection
  // Como os outros enxergam a pessoa agora.
  display: CosmeticDisplay
}

// Leitura da própria vitrine pro seletor.
export class ListMyCosmeticsUseCase {
  constructor(
    private readonly catalog: CosmeticCatalogRepository,
    private readonly selections: CosmeticSelectionRepository,
    private readonly referrals?: ReferralUnlocks,
  ) {}

  async execute(userId: string): Promise<MyCosmetics> {
    const [items, selection, referralCount] = await Promise.all([
      this.catalog.listActive(),
      this.selections.find(userId),
      this.referrals?.qualifiedCount(userId) ?? 0,
    ])
    return {
      catalog: items,
      referralCount,
      selection,
      display: resolveDisplay(selection, items),
    }
  }
}
