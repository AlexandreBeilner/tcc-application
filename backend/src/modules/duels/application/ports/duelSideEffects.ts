export interface XpGrant {
  award(userId: string, amount: number, reason: string): Promise<void>
}

export interface DuelFeedRecorder {
  recordResult(input: {
    userId: string
    kind: 'won' | 'draw'
    duelId: string
    opponentUsername: string
    opponentName: string
    reason: 'profitability' | 'abandonment' | 'tie' | 'both_inactive'
  }): Promise<void>
}
