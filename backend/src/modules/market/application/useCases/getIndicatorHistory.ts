import type { IndicatorHistoryEntry, IndicatorHistoryReader } from '../ports/indicatorHistoryReader'

export interface GetIndicatorHistoryInput {
  days?: number
}

export class GetIndicatorHistoryUseCase {
  constructor(private readonly indicatorHistoryReader: IndicatorHistoryReader) {}

  execute(input: GetIndicatorHistoryInput): Promise<IndicatorHistoryEntry[]> {
    return this.indicatorHistoryReader.getIndicatorHistory(input.days)
  }
}
