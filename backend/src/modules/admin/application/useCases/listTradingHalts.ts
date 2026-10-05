import type { TradingHaltAdmin, TradingHaltListing } from '../ports/tradingHaltAdmin'

// Delegação fina (leitura): pausas vigentes e as últimas encerradas.
export class ListTradingHaltsUseCase {
  constructor(private readonly tradingHaltAdmin: TradingHaltAdmin) {}

  async execute(): Promise<TradingHaltListing> {
    return this.tradingHaltAdmin.list()
  }
}
