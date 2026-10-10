import type { DuelPerformanceReader } from '../../application/ports/duelPerformanceReader'

// Ponte em processo para o módulo `ranking` (`MeasurePeriodReturnUseCase`): só percentual e se
// operou atravessam a fronteira (RNF09).
export function createInProcessDuelPerformanceReader(source: {
  execute(input: {
    userId: string
    from: Date
    to: Date
  }): Promise<{ returnPct: number; operated: boolean }>
}): DuelPerformanceReader {
  return {
    async measure(userId, from, to) {
      const { returnPct, operated } = await source.execute({ userId, from, to })
      return { returnPct, operated }
    },
  }
}
