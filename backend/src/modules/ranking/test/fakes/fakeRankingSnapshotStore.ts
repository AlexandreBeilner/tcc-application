import type {
  RankingSnapshotRead,
  RankingSnapshotRun,
  RankingSnapshotStore,
} from '../../application/ports/rankingSnapshotStore'

export function createFakeRankingSnapshotStore(): RankingSnapshotStore & {
  runs: RankingSnapshotRun[]
} {
  const runs: RankingSnapshotRun[] = []
  return {
    runs,
    async saveRun(run) {
      runs.push(run)
    },
    async readLatest(criterion, window): Promise<RankingSnapshotRead | null> {
      const latest = [...runs].sort((a, b) => b.computedAt.getTime() - a.computedAt.getTime())[0]
      const group = latest?.groups.find((g) => g.criterion === criterion && g.window === window)
      return latest && group ? { computedAt: latest.computedAt, entries: group.entries } : null
    },
    async deleteRunsBefore(cutoff) {
      for (let i = runs.length - 1; i >= 0; i--) {
        if (runs[i].computedAt.getTime() < cutoff.getTime()) runs.splice(i, 1)
      }
    },
  }
}
