import type {
  IndicatorHistoryEntry,
  IndicatorHistoryReader,
} from '../../application/ports/indicatorHistoryReader'

export interface FakeIndicatorHistoryReader extends IndicatorHistoryReader {
  getIndicatorHistoryCalls: Array<number | undefined>
  errorToThrow?: Error
}

export function createFakeIndicatorHistoryReader(results: {
  history?: IndicatorHistoryEntry[]
}): FakeIndicatorHistoryReader {
  const fake: FakeIndicatorHistoryReader = {
    getIndicatorHistoryCalls: [],
    errorToThrow: undefined,
    async getIndicatorHistory(days) {
      fake.getIndicatorHistoryCalls.push(days)
      if (fake.errorToThrow) throw fake.errorToThrow
      return results.history ?? []
    },
  }
  return fake
}
