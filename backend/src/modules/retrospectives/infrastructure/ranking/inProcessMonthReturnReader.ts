import type { MonthReturnReader } from '../../application/ports/monthReturnReader'

// Ponte em processo para o módulo `ranking` (`MeasurePeriodReturnUseCase`): só o percentual
// atravessa a fronteira (RNF09).
export function createInProcessMonthReturnReader(source: {
  execute(input: { userId: string; from: Date; to: Date }): Promise<{ returnPct: number }>
}): MonthReturnReader {
  return {
    async returnPct(userId, from, to) {
      return (await source.execute({ userId, from, to })).returnPct
    },
  }
}
