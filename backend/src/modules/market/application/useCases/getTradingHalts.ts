import type { MarketCalendarReader, TradingHaltStatus } from '../ports/marketCalendarReader'

// Pausa de negociação vigente (N.9) pro aviso ao usuário. Delegação fina ao motor.
export class GetTradingHaltsUseCase {
  constructor(private readonly marketCalendarReader: MarketCalendarReader) {}

  execute(): Promise<TradingHaltStatus> {
    return this.marketCalendarReader.getTradingHalts()
  }
}
