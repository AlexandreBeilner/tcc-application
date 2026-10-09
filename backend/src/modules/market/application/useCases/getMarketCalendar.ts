import type {
  CalendarScope,
  MarketCalendar,
  MarketCalendarReader,
} from '../ports/marketCalendarReader'

export interface GetMarketCalendarInput {
  userId: string
  from?: string
  to?: string
  scope?: CalendarScope
  marketLimit?: number
}

export class GetMarketCalendarUseCase {
  constructor(private readonly marketCalendarReader: MarketCalendarReader) {}

  execute(input: GetMarketCalendarInput): Promise<MarketCalendar> {
    return this.marketCalendarReader.getCalendar(input.userId, {
      from: input.from,
      to: input.to,
      scope: input.scope,
      market_limit: input.marketLimit,
    })
  }
}
