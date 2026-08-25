import type { AssetPriceHistoryReader } from '../../application/ports/assetPriceHistoryReader'

export function createFakeAssetPriceHistoryReader(
  priceByAssetId: Record<string, number> = {},
): AssetPriceHistoryReader {
  return {
    async priceAsOf(assetId: string) {
      return priceByAssetId[assetId] ?? 0
    },
  }
}
