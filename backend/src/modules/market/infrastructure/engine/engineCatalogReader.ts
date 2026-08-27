import type {
  AssetDetail,
  AssetSummary,
  CatalogReader,
  CompanyDetail,
  QuotePoint,
} from '../../application/ports/catalogReader'
import { engineFetch } from './engineHttp'

export function createEngineCatalogReader(engineUrl: string): CatalogReader {
  return {
    listAssets(type) {
      const qs = type ? `?type=${encodeURIComponent(type)}` : ''
      return engineFetch<AssetSummary[]>(`${engineUrl}/assets${qs}`)
    },

    getAsset(id) {
      return engineFetch<AssetDetail>(`${engineUrl}/assets/${id}`)
    },

    getAssetQuotes(id, days) {
      const qs = days !== undefined ? `?days=${days}` : ''
      return engineFetch<QuotePoint[]>(`${engineUrl}/assets/${id}/quotes${qs}`)
    },

    getCompany(id) {
      return engineFetch<CompanyDetail>(`${engineUrl}/companies/${id}`)
    },
  }
}
