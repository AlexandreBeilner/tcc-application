import type { CatalogAdmin, CreatedCatalogAsset, NewCatalogAsset } from '../ports/catalogAdmin'
import type { RecordAdminActionUseCase } from './recordAdminAction'

// Cadastra um ativo novo (N.13): catálogo, bots novos e cobertura de Market Maker são do motor.
// Aqui só a auditoria, inclusive quando o motor recusa ou falha no meio. O pedido inteiro vai no
// payload (só dado de catálogo, nada sensível); o id do ativo criado só existe no resultado, então
// o `target_id` fica no ticker.
export class CreateCatalogAssetUseCase {
  constructor(
    private readonly catalogAdmin: CatalogAdmin,
    private readonly recordAdminAction: RecordAdminActionUseCase,
  ) {}

  async execute(adminId: string, asset: NewCatalogAsset): Promise<CreatedCatalogAsset> {
    return this.recordAdminAction.run(
      {
        adminId,
        action: 'catalog.create',
        targetType: 'asset',
        targetId: asset.ticker,
        payload: { ...asset },
      },
      () => this.catalogAdmin.create(asset, adminId),
    )
  }
}
