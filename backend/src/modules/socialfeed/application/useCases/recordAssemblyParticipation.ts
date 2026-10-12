import type { AssemblyFeedData } from '../../domain/socialFeedEvent'
import type { SocialFeedEventRepository } from '../ports/socialFeedEventRepository'

export interface RecordAssemblyParticipationInput {
  userId: string
  data: AssemblyFeedData
}

// Consumida em processo por `modules/assemblies` ao publicar o resultado (MO.6.7), via port
// própria. Idempotente por assembleia e pessoa. Só quem votou entra no feed: a linha mostra a
// participação, nunca a opção escolhida.
export class RecordAssemblyParticipationUseCase {
  constructor(private readonly repository: SocialFeedEventRepository) {}

  async execute(input: RecordAssemblyParticipationInput): Promise<void> {
    await this.repository.recordAssemblyParticipation(input.userId, input.data)
  }
}
