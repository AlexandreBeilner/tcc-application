import type { SocialFeedEventRepository } from '../ports/socialFeedEventRepository'

export interface RecordTrackCompletedInput {
  userId: string
  trackNumber: number
}

// Consumida em processo por `modules/lessons` (G.1) — `AdvanceLessonUseCase`
// chama isto no exato ponto em que já sabe que a última lição de uma
// trilha acabou de ser concluída, via port própria de `lessons`
// (`SocialFeedRecorder`), mesmo padrão de composição de `xpAwarder`/
// `streakTracker`.
export class RecordTrackCompletedUseCase {
  constructor(private readonly socialFeedEventRepository: SocialFeedEventRepository) {}

  async execute(input: RecordTrackCompletedInput): Promise<void> {
    await this.socialFeedEventRepository.record(input.userId, 'track_completed', input.trackNumber)
  }
}
