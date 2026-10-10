import type { CosmeticItem, CosmeticSelection } from '../../domain/cosmetic'
import { resolveDisplay, type CosmeticDisplay } from '../../domain/cosmetic'
import type { CosmeticCatalogRepository } from '../ports/cosmeticCatalogRepository'
import type { CosmeticSelectionRepository } from '../ports/cosmeticSelectionRepository'
import type { ProMembershipReader } from '../ports/proMembershipReader'

export interface MyCosmetics {
  isPro: boolean
  catalog: CosmeticItem[]
  // O que a pessoa escolheu. Pra quem deixou de ser PRO a escolha segue guardada aqui (arquivada)
  // e só volta a aparecer para os outros quando reativar.
  selection: CosmeticSelection
  // Como os outros enxergam a pessoa agora.
  display: CosmeticDisplay
}

// Leitura da própria vitrine pro seletor. Não exige PRO: quem cancelou ainda vê o que tinha.
export class ListMyCosmeticsUseCase {
  constructor(
    private readonly catalog: CosmeticCatalogRepository,
    private readonly selections: CosmeticSelectionRepository,
    private readonly membership: ProMembershipReader,
  ) {}

  async execute(userId: string): Promise<MyCosmetics> {
    const [items, selection, proIds] = await Promise.all([
      this.catalog.listActive(),
      this.selections.find(userId),
      this.membership.listProUserIds([userId]),
    ])
    const isPro = proIds.has(userId)
    return { isPro, catalog: items, selection, display: resolveDisplay(isPro, selection, items) }
  }
}
