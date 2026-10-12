import type { AssetPriceSeries, AssetPriceSeriesReader } from '../ports/assetPriceSeriesReader'

export const DEFAULT_PRICE_SERIES_DAYS = 30

export interface GetAssetPriceSeriesInput {
  days?: number
}

export class GetAssetPriceSeriesUseCase {
  constructor(private readonly reader: AssetPriceSeriesReader) {}

  execute(input: GetAssetPriceSeriesInput): Promise<AssetPriceSeries> {
    return this.reader.getRecentPrices(input.days ?? DEFAULT_PRICE_SERIES_DAYS)
  }
}
