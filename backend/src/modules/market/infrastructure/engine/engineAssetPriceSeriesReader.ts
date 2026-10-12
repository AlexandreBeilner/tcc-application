import type {
  AssetPriceSeries,
  AssetPriceSeriesReader,
} from '../../application/ports/assetPriceSeriesReader'
import { engineFetch } from './engineHttp'

export function createEngineAssetPriceSeriesReader(engineUrl: string): AssetPriceSeriesReader {
  return {
    async getRecentPrices(days) {
      const body = await engineFetch<{ series: AssetPriceSeries }>(
        `${engineUrl}/assets/quotes?days=${days}`,
      )
      return body.series
    },
  }
}
