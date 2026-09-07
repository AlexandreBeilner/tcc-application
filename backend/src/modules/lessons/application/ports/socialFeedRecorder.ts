// Port própria e mínima sobre `modules/socialfeed` (backlog engajamento
// G.1), mesmo padrão de `xpAwarder.ts`/`streakTracker.ts` — implementada,
// na composição (app.ts), por um adapter em processo sobre
// `RecordTrackCompletedUseCase`.
export interface SocialFeedRecorder {
  recordTrackCompleted(userId: string, trackNumber: number): Promise<void>
}
