import type { MarketMonitorReader, MonitorAsset } from '../ports/marketMonitorReader'

// Delegação fina (leitura), mesmo padrão de ListMacroEventsUseCase.
export class ListMarketMonitorUseCase {
  constructor(private readonly monitor: MarketMonitorReader) {}

  async execute(): Promise<MonitorAsset[]> {
    return this.monitor.listAssets()
  }
}
