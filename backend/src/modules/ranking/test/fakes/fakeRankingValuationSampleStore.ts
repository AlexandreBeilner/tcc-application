import type {
  RankingValuationSampleStore,
  ValuationSample,
} from '../../application/ports/rankingValuationSampleStore'
import type { Snapshot } from '../../domain/networth'

export function createFakeRankingValuationSampleStore(): RankingValuationSampleStore & {
  saved: { computedAt: Date; samples: ValuationSample[] }[]
} {
  const saved: { computedAt: Date; samples: ValuationSample[] }[] = []
  return {
    saved,
    async saveSamples(computedAt, samples) {
      saved.push({ computedAt, samples })
    },
    async findBaselines(notBefore, notAfter) {
      const result = new Map<string, Snapshot>()
      const inRange = saved
        .filter((s) => s.computedAt >= notBefore && s.computedAt <= notAfter)
        .sort((a, b) => a.computedAt.getTime() - b.computedAt.getTime())
      for (const { samples } of inRange) {
        for (const sample of samples) {
          if (!result.has(sample.userId)) result.set(sample.userId, sample.snapshot)
        }
      }
      return result
    },
    async deleteSamplesBefore(cutoff) {
      for (let i = saved.length - 1; i >= 0; i--) {
        if (saved[i].computedAt < cutoff) saved.splice(i, 1)
      }
    },
  }
}
