import { defaultProgression, type Progression } from '../../domain/progression'
import type { ProgressionRepository } from '../ports/progressionRepository'

export interface GetProgressionInput {
  userId: string
}

export class GetProgressionUseCase {
  constructor(private readonly progressionRepository: ProgressionRepository) {}

  async execute(input: GetProgressionInput): Promise<Progression> {
    const progression = await this.progressionRepository.findByUserId(input.userId)
    // Usuário sem nenhuma atividade ainda nasce implicitamente no estado
    // zerado — não precisa de linha em `user_progression` até o primeiro
    // crédito de xp ou streak (AwardXpUseCase/TouchStreakUseCase fazem o
    // mesmo fallback).
    return progression ?? defaultProgression(input.userId)
  }
}
