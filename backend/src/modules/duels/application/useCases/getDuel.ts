import type { CosmeticsReader } from '../../../../shared/publicCosmetics'
import { DuelNotFoundError } from '../../domain/errors'
import { buildDuelViews, type DuelView, type PlayerScore } from '../duelView'
import type { DuelPerformanceReader } from '../ports/duelPerformanceReader'
import type { DuelRepository } from '../ports/duelRepository'
import type { DuelUserDirectory } from '../ports/duelUserDirectory'

// Detalhe de um duelo, só para os dois participantes (qualquer outra pessoa recebe "não
// encontrado"). Em andamento mostra o placar parcial de agora; falha ao medir deixa o placar
// vazio em vez de derrubar a tela. Encerrado mostra o resultado gravado.
export class GetDuelUseCase {
  constructor(
    private readonly duels: DuelRepository,
    private readonly performance: DuelPerformanceReader,
    private readonly users: DuelUserDirectory,
    private readonly cosmeticsReader?: CosmeticsReader,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(input: { userId: string; duelId: string }): Promise<DuelView> {
    const duel = await this.duels.findById(input.duelId)
    if (!duel || (duel.challengerId !== input.userId && duel.opponentId !== input.userId)) {
      throw new DuelNotFoundError('duelo não encontrado')
    }
    const live = new Map<string, { you: PlayerScore; them: PlayerScore }>()
    if (duel.status === 'active' && duel.startsAt) {
      const to = new Date(Math.min(this.now().getTime(), duel.endsAt?.getTime() ?? Infinity))
      const otherId = duel.challengerId === input.userId ? duel.opponentId : duel.challengerId
      try {
        const [you, them] = await Promise.all([
          this.performance.measure(input.userId, duel.startsAt, to),
          this.performance.measure(otherId, duel.startsAt, to),
        ])
        live.set(duel.id, { you, them })
      } catch (err) {
        console.error(`duelos: falha ao medir o placar parcial do duelo ${duel.id}:`, err)
      }
    }
    const [view] = await buildDuelViews(
      [duel],
      input.userId,
      this.users,
      this.cosmeticsReader,
      live,
    )
    return view
  }
}
