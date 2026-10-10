import type { CosmeticKind } from '../../domain/cosmetic'
import { CosmeticItemNotFoundError } from '../../domain/errors'
import type { CosmeticCatalogRepository } from '../ports/cosmeticCatalogRepository'
import type { CosmeticSelectionRepository } from '../ports/cosmeticSelectionRepository'
import type { ProAccess } from '../ports/proAccess'

export interface EquipCosmeticInput {
  userId: string
  kind: CosmeticKind
  itemKey: string
}

// Equipar é capacidade PRO (403 sem plano ativo). O item tem de existir, estar ativo e ser do
// tipo do espaço pedido.
export class EquipCosmeticUseCase {
  constructor(
    private readonly access: ProAccess,
    private readonly catalog: CosmeticCatalogRepository,
    private readonly selections: CosmeticSelectionRepository,
  ) {}

  async execute(input: EquipCosmeticInput): Promise<void> {
    await this.access.assertPro(input.userId)
    const items = await this.catalog.listActive()
    const item = items.find((i) => i.key === input.itemKey && i.kind === input.kind)
    if (!item) throw new CosmeticItemNotFoundError()
    await this.selections.equip(input.userId, input.kind, item.key)
  }
}
