import { describe, expect, it } from 'vitest'
import { CatalogAssetConflictError, CatalogAssetRejectedError } from '../../domain/errors'
import { createFakeAuditLogRepository } from '../../test/fakes/fakeAuditLogRepository'
import { createFakeCatalogAdmin } from '../../test/fakes/fakeCatalogAdmin'
import type { NewCatalogAsset } from '../ports/catalogAdmin'
import { CreateCatalogAssetUseCase } from './createCatalogAsset'
import { ListAdminCatalogUseCase } from './listAdminCatalog'
import { PreviewCatalogAssetUseCase } from './previewCatalogAsset'
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
    preview: new PreviewCatalogAssetUseCase(catalogAdmin),
    create: new CreateCatalogAssetUseCase(catalogAdmin, new RecordAdminActionUseCase(auditLog)),
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

const newFii: NewCatalogAsset = {
  kind: 'fii_papel',
  ticker: 'NOVP11',
  name: 'FII Novo',
  indexador: 'CDI',
}

describe('PreviewCatalogAssetUseCase', () => {
  it('delega ao motor, sem gravar e sem auditar', async () => {
    const { preview, catalogAdmin, auditLog } = build()
    expect((await preview.execute(newFii)).ticker).toBe('NOVA3')
    expect(catalogAdmin.calls).toEqual(['preview'])
    expect(auditLog.entries).toHaveLength(0)
  })
})

describe('CreateCatalogAssetUseCase', () => {
  it('cadastra no motor com o admin do token e audita catalog.create com o pedido', async () => {
    const { create, catalogAdmin, auditLog } = build()

    const created = await create.execute('admin-1', newFii)

    expect(created.asset_id).toBe('new-asset-id')
    expect(catalogAdmin.created).toEqual([{ asset: newFii, adminId: 'admin-1' }])
    expect(auditLog.entries[0]).toMatchObject({
      adminId: 'admin-1',
      action: 'catalog.create',
      targetType: 'asset',
      targetId: 'NOVP11',
      result: 'success',
      payload: newFii,
    })
  })

  it('colisão de ticker: propaga o erro e audita como falha', async () => {
    const { create, catalogAdmin, auditLog } = build()
    catalogAdmin.errorToThrow = new CatalogAssetConflictError('o ticker NOVP11 já existe')

    await expect(create.execute('admin-1', newFii)).rejects.toThrow(CatalogAssetConflictError)
    expect(auditLog.entries[0]).toMatchObject({ action: 'catalog.create', result: 'failed' })
  })
})
