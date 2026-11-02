import type {
  BaselineSample,
  RankingValuationSampleStore,
  ValuationSample,
} from '../../application/ports/rankingValuationSampleStore'

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
      const result = new Map<string, BaselineSample>()
      const inRange = saved
        .filter((s) => s.computedAt >= notBefore && s.computedAt <= notAfter)
        .sort((a, b) => a.computedAt.getTime() - b.computedAt.getTime())
      for (const { computedAt, samples } of inRange) {
        for (const sample of samples) {
          if (!result.has(sample.userId)) {
            result.set(sample.userId, { snapshot: sample.snapshot, computedAt })
          }
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
