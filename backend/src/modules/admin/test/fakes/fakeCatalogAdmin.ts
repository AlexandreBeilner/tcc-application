import type { CatalogAdmin, CatalogAsset, CatalogPatch } from '../../application/ports/catalogAdmin'

export interface FakeCatalogAdmin extends CatalogAdmin {
  calls: string[]
  updates: Array<{ assetId: string; patch: CatalogPatch; adminId: string }>
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

export function createFakeCatalogAdmin(): FakeCatalogAdmin {
  const fake: FakeCatalogAdmin = {
    calls: [],
    updates: [],
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
  }
  return fake
}
