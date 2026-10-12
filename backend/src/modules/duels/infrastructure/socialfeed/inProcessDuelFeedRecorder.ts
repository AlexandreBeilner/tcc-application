import type { DuelFeedRecorder } from '../../application/ports/duelSideEffects'

// Ponte em processo para `RecordDuelResultUseCase` do módulo `socialfeed`.
export function createInProcessDuelFeedRecorder(recorder: {
  execute(input: {
    userId: string
    kind: 'won' | 'draw'
    data: {
      duelId: string
      opponentUsername: string
      opponentName: string
      reason: 'profitability' | 'abandonment' | 'tie' | 'both_inactive'
    }
  }): Promise<void>
}): DuelFeedRecorder {
  return {
    async recordResult({ userId, kind, ...data }) {
      await recorder.execute({ userId, kind, data })
    },
  }
}
