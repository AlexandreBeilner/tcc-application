import type {
  AssetBook,
  AssetDetail,
  AssetSummary,
  CatalogReader,
  CompanyDetail,
  QuotePoint,
} from '../../application/ports/catalogReader'

export interface FakeCatalogReader extends CatalogReader {
  listAssetsCalls: Array<string | undefined>
  getAssetCalls: string[]
  getAssetQuotesCalls: Array<{ id: string; days: number | undefined }>
  getCompanyCalls: string[]
  getAssetBookCalls: Array<{ id: string; userId: string }>
  errorToThrow?: Error
}

export function createFakeCatalogReader(results: {
  assets?: AssetSummary[]
  asset?: AssetDetail
  quotes?: QuotePoint[]
  company?: CompanyDetail
  book?: AssetBook
}): FakeCatalogReader {
  const fake: FakeCatalogReader = {
    listAssetsCalls: [],
    getAssetCalls: [],
    getAssetQuotesCalls: [],
    getCompanyCalls: [],
    getAssetBookCalls: [],
    errorToThrow: undefined,
    async listAssets(type) {
      fake.listAssetsCalls.push(type)
      if (fake.errorToThrow) throw fake.errorToThrow
      return results.assets ?? []
    },
    async getAsset(id) {
      fake.getAssetCalls.push(id)
      if (fake.errorToThrow) throw fake.errorToThrow
      return results.asset as AssetDetail
    },
    async getAssetQuotes(id, days) {
      fake.getAssetQuotesCalls.push({ id, days })
      if (fake.errorToThrow) throw fake.errorToThrow
      return results.quotes ?? []
    },
    async getCompany(id) {
      fake.getCompanyCalls.push(id)
      if (fake.errorToThrow) throw fake.errorToThrow
      return results.company as CompanyDetail
    },
    async getAssetBook(id, userId) {
      fake.getAssetBookCalls.push({ id, userId })
      if (fake.errorToThrow) throw fake.errorToThrow
      return results.book as AssetBook
    },
  }
  return fake
}
