import type { CosmeticKind } from '../../domain/cosmetic'
import { CosmeticItemNotFoundError, CosmeticLockedError } from '../../domain/errors'
import type { CosmeticCatalogRepository } from '../ports/cosmeticCatalogRepository'
import type { CosmeticSelectionRepository } from '../ports/cosmeticSelectionRepository'
import type { ReferralUnlocks } from '../ports/referralUnlocks'

export interface EquipCosmeticInput {
  userId: string
  kind: CosmeticKind
  itemKey: string
}

// Equipar um item: ele tem de existir, estar ativo e ser do tipo do espaço pedido.
// Item liberado por indicações só equipa depois de alcançar o número pedido.
export class EquipCosmeticUseCase {
  constructor(
    private readonly catalog: CosmeticCatalogRepository,
    private readonly selections: CosmeticSelectionRepository,
    private readonly referrals?: ReferralUnlocks,
  ) {}

  async execute(input: EquipCosmeticInput): Promise<void> {
    const items = await this.catalog.listActive()
    const item = items.find((i) => i.key === input.itemKey && i.kind === input.kind)
    if (!item) throw new CosmeticItemNotFoundError()
    if (item.unlockReferrals) {
      const have = (await this.referrals?.qualifiedCount(input.userId)) ?? 0
      if (have < item.unlockReferrals) throw new CosmeticLockedError()
    }
    await this.selections.equip(input.userId, input.kind, item.key)
  }
}
