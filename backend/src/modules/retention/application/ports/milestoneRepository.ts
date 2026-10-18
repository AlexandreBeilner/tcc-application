import type { Milestone } from '../../domain/milestones'

export interface MilestoneRepository {
  // Grava só se a pessoa ainda não tinha o marco; o primeiro registro nunca é sobrescrito.
  recordIfAbsent(userId: string, milestone: Milestone, reachedAt: Date): Promise<void>
}
