import { describe, expect, it } from 'vitest'
import { CatalogAssetRejectedError } from '../../domain/errors'
import { createFakeAuditLogRepository } from '../../test/fakes/fakeAuditLogRepository'
import { createFakeCatalogAdmin } from '../../test/fakes/fakeCatalogAdmin'
import { ListAdminCatalogUseCase } from './listAdminCatalog'
import { RecordAdminActionUseCase } from './recordAdminAction'
import { UpdateCatalogAssetUseCase } from './updateCatalogAsset'

function build() {
  const catalogAdmin = createFakeCatalogAdmin()
  const auditLog = createFakeAuditLogRepository()
  return {
    catalogAdmin,
    auditLog,
    list: new ListAdminCatalogUseCase(catalogAdmin),
    update: new UpdateCatalogAssetUseCase(catalogAdmin, new RecordAdminActionUseCase(auditLog)),
  }
}

describe('ListAdminCatalogUseCase', () => {
  it('delega ao motor e não audita', async () => {
    const { list, auditLog } = build()
    expect(await list.execute()).toHaveLength(1)
    expect(auditLog.entries).toHaveLength(0)
  })
})

describe('UpdateCatalogAssetUseCase', () => {
  it('grava no motor com o admin do token e audita catalog.update com o patch', async () => {
    const { update, catalogAdmin, auditLog } = build()

    await update.execute('admin-1', 'asset-1', { name: 'Novo', base_growth_pct: 5 })

    expect(catalogAdmin.updates).toEqual([
      { assetId: 'asset-1', patch: { name: 'Novo', base_growth_pct: 5 }, adminId: 'admin-1' },
    ])
    expect(auditLog.entries[0]).toMatchObject({
      adminId: 'admin-1',
      action: 'catalog.update',
      targetType: 'asset',
      targetId: 'asset-1',
      result: 'success',
      payload: { name: 'Novo', base_growth_pct: 5 },
    })
  })

  it('recusa do motor: propaga o erro e audita como falha', async () => {
    const { update, catalogAdmin, auditLog } = build()
    catalogAdmin.errorToThrow = new CatalogAssetRejectedError('multiplicador fora da faixa')

    await expect(update.execute('admin-1', 'asset-1', { quality_multiplier: 9 })).rejects.toThrow(
      CatalogAssetRejectedError,
    )
    expect(auditLog.entries[0]).toMatchObject({
      action: 'catalog.update',
      result: 'failed',
      errorMessage: 'multiplicador fora da faixa',
    })
  })
})
