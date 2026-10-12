import type { CosmeticKind } from '../../domain/cosmetic'
import type { CosmeticSelectionRepository } from '../ports/cosmeticSelectionRepository'

// Tirar um item nunca exige PRO: a pessoa sempre pode se despir do que mostra.
export class UnequipCosmeticUseCase {
  constructor(private readonly selections: CosmeticSelectionRepository) {}

  async execute(userId: string, kind: CosmeticKind): Promise<void> {
    await this.selections.unequip(userId, kind)
  }
}
