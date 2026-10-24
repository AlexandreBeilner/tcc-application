import type { CosmeticKind } from '../../domain/cosmetic'
import type { CosmeticSelectionRepository } from '../ports/cosmeticSelectionRepository'

// A pessoa sempre pode tirar o que mostra.
export class UnequipCosmeticUseCase {
  constructor(private readonly selections: CosmeticSelectionRepository) {}

  async execute(userId: string, kind: CosmeticKind): Promise<void> {
    await this.selections.unequip(userId, kind)
  }
}
