import type {
  CatalogAdmin,
  CatalogAsset,
  CatalogPatch,
  NewCatalogAsset,
  NewCatalogAssetPreview,
} from '../../application/ports/catalogAdmin'

export interface FakeCatalogAdmin extends CatalogAdmin {
  calls: string[]
  updates: Array<{ assetId: string; patch: CatalogPatch; adminId: string }>
  created: Array<{ asset: NewCatalogAsset; adminId: string }>
  errorToThrow?: Error
}

export const sampleCatalogAsset: CatalogAsset = {
  asset_id: '11111111-1111-4111-8111-111111111111',
  ticker: 'ACME3',
  name: 'Acme',
  type: 'acao',
  risk_class: null,
  is_sandbox: false,
  share_class: 'ON',
  outstanding_shares: 1000,
  editable: ['name', 'base_growth_pct', 'quality_multiplier'],
  company: {
    company_id: 'c1',
    name: 'Acme SA',
    sector: 'Varejo',
    report_frequency_days: 91,
    base_growth_pct: 3,
    quality_multiplier: 1,
  },
  etf: null,
  fii: null,
  fixed_income: null,
}

export const samplePreview: NewCatalogAssetPreview = {
  kind: 'acao',
  ticker: 'NOVA3',
  name: 'Nova ON',
  outstanding_shares: 200000000,
  pool: {
    pool_before: 60,
    pool_after: 62,
    new_bots: 2,
    market_maker_shares: 100000000,
    bot_shares: 100000000,
    market_maker_id: 'mm-1',
    creates_market_maker: false,
  },
}

export function createFakeCatalogAdmin(): FakeCatalogAdmin {
  const fake: FakeCatalogAdmin = {
    calls: [],
    updates: [],
    created: [],
    errorToThrow: undefined,
    async list() {
      fake.calls.push('list')
      if (fake.errorToThrow) throw fake.errorToThrow
      return [sampleCatalogAsset]
    },
    async update(assetId, patch, adminId) {
      fake.calls.push('update')
      fake.updates.push({ assetId, patch, adminId })
      if (fake.errorToThrow) throw fake.errorToThrow
      return { ...sampleCatalogAsset, name: patch.name ?? sampleCatalogAsset.name }
    },
    async preview() {
      fake.calls.push('preview')
      if (fake.errorToThrow) throw fake.errorToThrow
      return samplePreview
    },
    async create(asset, adminId) {
      fake.calls.push('create')
      fake.created.push({ asset, adminId })
      if (fake.errorToThrow) throw fake.errorToThrow
      return { asset_id: 'new-asset-id', preview: samplePreview }
    },
  }
  return fake
}
