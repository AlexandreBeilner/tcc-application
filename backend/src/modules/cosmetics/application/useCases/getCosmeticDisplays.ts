import { NO_COSMETICS, resolveDisplay, type CosmeticDisplay } from '../../domain/cosmetic'
import type { CosmeticCatalogRepository } from '../ports/cosmeticCatalogRepository'
import type { CosmeticSelectionRepository } from '../ports/cosmeticSelectionRepository'
import type { ProMembershipReader } from '../ports/proMembershipReader'

// Vitrine pública de vários usuários de uma vez (ranking, feed, busca, perfil), em 3 consultas
// fixas, sem importar o tamanho da página. Nunca devolve nada além de selo, moldura e título:
// cosmético não carrega patrimônio nem muda posição em ranking (RNF09).
export class GetCosmeticDisplaysUseCase {
  constructor(
    private readonly catalog: CosmeticCatalogRepository,
    private readonly selections: CosmeticSelectionRepository,
    private readonly membership: ProMembershipReader,
  ) {}

  async execute(userIds: string[]): Promise<Map<string, CosmeticDisplay>> {
    const unique = [...new Set(userIds)]
    const result = new Map<string, CosmeticDisplay>()
    if (unique.length === 0) return result

    const [proIds, selections, catalog] = await Promise.all([
      this.membership.listProUserIds(unique),
      this.selections.findMany(unique),
      this.catalog.listActive(),
    ])
    for (const id of unique) {
      const selection = selections.get(id) ?? { frame: null, title: null }
      result.set(id, proIds.has(id) ? resolveDisplay(true, selection, catalog) : NO_COSMETICS)
    }
    return result
  }
}
