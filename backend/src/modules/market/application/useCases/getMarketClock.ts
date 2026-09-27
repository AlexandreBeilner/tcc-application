import type { MarketCalendarReader, MarketClock } from '../ports/marketCalendarReader'

export class GetMarketClockUseCase {
  constructor(private readonly marketCalendarReader: MarketCalendarReader) {}

  execute(): Promise<MarketClock> {
    return this.marketCalendarReader.getClock()
  }
}
