import type { MarketMonitorReader, MonitorAssetDetail } from '../ports/marketMonitorReader'

export class GetMarketMonitorAssetUseCase {
  constructor(private readonly monitor: MarketMonitorReader) {}

  async execute(assetId: string): Promise<MonitorAssetDetail> {
    return this.monitor.getAsset(assetId)
  }
}
