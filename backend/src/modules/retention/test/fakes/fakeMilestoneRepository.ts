import type { MilestoneRepository } from '../../application/ports/milestoneRepository'
import type { Milestone } from '../../domain/milestones'

export class FakeMilestoneRepository implements MilestoneRepository {
  readonly reached = new Map<string, Date>()
  fail = false

  async recordIfAbsent(userId: string, milestone: Milestone, reachedAt: Date): Promise<void> {
    if (this.fail) throw new Error('banco fora do ar')
    const key = `${userId}:${milestone}`
    if (!this.reached.has(key)) this.reached.set(key, reachedAt)
  }
}
