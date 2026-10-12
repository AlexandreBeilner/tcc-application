import type { DuelFeedData } from '../../domain/socialFeedEvent'
import type { SocialFeedEventRepository } from '../ports/socialFeedEventRepository'

export interface RecordDuelResultInput {
  // Quem entra no feed: a pessoa que venceu, ou quem desafiou no caso de empate. Nunca a
  // pessoa que perdeu: o feed celebra, não expõe derrota.
  userId: string
  kind: 'won' | 'draw'
  data: DuelFeedData
}

// Consumida em processo por `modules/duels` ao encerrar um duelo (MO.5.3), via port própria.
export class RecordDuelResultUseCase {
  constructor(private readonly repository: SocialFeedEventRepository) {}

  async execute(input: RecordDuelResultInput): Promise<void> {
    await this.repository.record(
      input.userId,
      input.kind === 'won' ? 'duel_won' : 'duel_draw',
      null,
      input.data,
    )
  }
}
