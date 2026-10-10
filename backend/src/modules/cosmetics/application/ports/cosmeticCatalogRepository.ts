import type { CosmeticItem } from '../../domain/cosmetic'

export interface CosmeticCatalogRepository {
  // Só itens ativos, na ordem de exibição.
  listActive(): Promise<CosmeticItem[]>
}
