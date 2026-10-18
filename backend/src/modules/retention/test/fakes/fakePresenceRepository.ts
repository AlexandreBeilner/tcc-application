import type { PresenceRepository } from '../../application/ports/presenceRepository'

export class FakePresenceRepository implements PresenceRepository {
  readonly writes: Array<{ userId: string; day: string }> = []
  failNext = false

  async record(userId: string, day: string): Promise<void> {
    if (this.failNext) {
      this.failNext = false
      throw new Error('banco fora do ar')
    }
    this.writes.push({ userId, day })
  }
}
