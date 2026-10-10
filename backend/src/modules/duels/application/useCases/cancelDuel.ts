import { DuelNotFoundError, DuelNotPendingError, NotDuelChallengerError } from '../../domain/errors'
import type { DuelRepository } from '../ports/duelRepository'

// Quem desafiou desiste de um desafio que ainda não foi aceito (libera a vaga). Duelo em
// andamento não se cancela: vai até o fim.
export class CancelDuelUseCase {
  constructor(
    private readonly duels: DuelRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(input: { userId: string; duelId: string }): Promise<void> {
    const duel = await this.duels.findById(input.duelId)
    if (!duel || (duel.challengerId !== input.userId && duel.opponentId !== input.userId)) {
      throw new DuelNotFoundError('duelo não encontrado')
    }
    if (duel.challengerId !== input.userId) {
      throw new NotDuelChallengerError('só quem desafiou pode cancelar')
    }
    if (!(await this.duels.cancel(duel.id, this.now()))) {
      throw new DuelNotPendingError('só dá para cancelar um desafio que ainda não foi aceito')
    }
  }
}
