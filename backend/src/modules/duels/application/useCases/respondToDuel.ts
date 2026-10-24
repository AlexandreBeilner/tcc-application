import { duelEnd, MAX_SIMULTANEOUS_DUELS } from '../../domain/duel'
import {
  DuelNotFoundError,
  DuelNotPendingError,
  NotDuelOpponentError,
  TooManyDuelsError,
} from '../../domain/errors'
import type { DuelRepository } from '../ports/duelRepository'

// Aceitar ou recusar um desafio. O duelo começa no instante do aceite e dura 7 dias.
export class RespondToDuelUseCase {
  constructor(
    private readonly duels: DuelRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(input: { userId: string; duelId: string; accept: boolean }): Promise<void> {
    const duel = await this.duels.findById(input.duelId)
    if (!duel || (duel.challengerId !== input.userId && duel.opponentId !== input.userId)) {
      throw new DuelNotFoundError('duelo não encontrado')
    }
    if (duel.opponentId !== input.userId) {
      throw new NotDuelOpponentError('só quem foi desafiado pode responder')
    }
    const now = this.now()
    if (duel.status !== 'pending' || duel.expiresAt.getTime() <= now.getTime()) {
      throw new DuelNotPendingError('esse desafio não está mais aguardando resposta')
    }

    if (!input.accept) {
      if (!(await this.duels.decline(duel.id, now))) {
        throw new DuelNotPendingError('esse desafio não está mais aguardando resposta')
      }
      return
    }

    const outcome = await this.duels.acceptIfRoom(
      duel.id,
      input.userId,
      now,
      duelEnd(now),
      MAX_SIMULTANEOUS_DUELS,
    )
    if (outcome === 'full') {
      throw new TooManyDuelsError(
        `você já tem ${MAX_SIMULTANEOUS_DUELS} duelos em andamento; espere um terminar para aceitar`,
      )
    }
    if (outcome === 'gone') {
      throw new DuelNotPendingError('esse desafio não está mais aguardando resposta')
    }
  }
}
