import type { CosmeticsReader } from '../../../../shared/publicCosmetics'
import { buildDuelViews, type DuelView } from '../duelView'
import type { DuelRepository } from '../ports/duelRepository'
import type { DuelUserDirectory } from '../ports/duelUserDirectory'

// Teto de itens devolvidos (os mais recentes); duelos encerrados ficam arquivados, nunca somem.
const LIST_LIMIT = 50

export class ListMyDuelsUseCase {
  constructor(
    private readonly duels: DuelRepository,
    private readonly users: DuelUserDirectory,
    private readonly cosmeticsReader?: CosmeticsReader,
  ) {}

  async execute(userId: string): Promise<DuelView[]> {
    const duels = await this.duels.listForUser(userId, LIST_LIMIT)
    return buildDuelViews(duels, userId, this.users, this.cosmeticsReader)
  }
}
