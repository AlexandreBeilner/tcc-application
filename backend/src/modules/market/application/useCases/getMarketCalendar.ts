import type { MarketCalendar, MarketCalendarReader } from '../ports/marketCalendarReader'

export interface GetMarketCalendarInput {
  userId: string
  from?: string
  to?: string
}

export class GetMarketCalendarUseCase {
  constructor(private readonly marketCalendarReader: MarketCalendarReader) {}

  execute(input: GetMarketCalendarInput): Promise<MarketCalendar> {
    return this.marketCalendarReader.getCalendar(input.userId, { from: input.from, to: input.to })
  }
}
