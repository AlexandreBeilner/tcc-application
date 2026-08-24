import type { Progression } from '../../domain/progression'
import type { ProgressionRepository } from '../ports/progressionRepository'

export interface GetProgressionInput {
  userId: string
}

export class GetProgressionUseCase {
  constructor(private readonly progressionRepository: ProgressionRepository) {}

  async execute(input: GetProgressionInput): Promise<Progression> {
    const progression = await this.progressionRepository.findByUserId(input.userId)
    // Usuário sem nenhum crédito de xp ainda nasce implicitamente em
    // xp=0/nível=1 — não precisa de linha em `user_progression` até o
    // primeiro crédito (AwardXpUseCase faz o mesmo fallback).
    return progression ?? { userId: input.userId, xp: 0, level: 1 }
  }
}
