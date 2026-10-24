import { resolveDisplay, type CosmeticDisplay } from '../../domain/cosmetic'
import type { CosmeticCatalogRepository } from '../ports/cosmeticCatalogRepository'
import type { CosmeticSelectionRepository } from '../ports/cosmeticSelectionRepository'

// Vitrine pública de vários usuários de uma vez (ranking, feed, busca, perfil), em 2 consultas
// fixas, sem importar o tamanho da página. Nunca devolve nada além de moldura e título:
// cosmético não carrega patrimônio nem muda posição em ranking (RNF09).
export class GetCosmeticDisplaysUseCase {
  constructor(
    private readonly catalog: CosmeticCatalogRepository,
    private readonly selections: CosmeticSelectionRepository,
  ) {}

  async execute(userIds: string[]): Promise<Map<string, CosmeticDisplay>> {
    const unique = [...new Set(userIds)]
    const result = new Map<string, CosmeticDisplay>()
    if (unique.length === 0) return result

    const [selections, catalog] = await Promise.all([
      this.selections.findMany(unique),
      this.catalog.listActive(),
    ])
    for (const id of unique) {
      const selection = selections.get(id) ?? { frame: null, title: null }
      result.set(id, resolveDisplay(selection, catalog))
    }
    return result
  }
}
