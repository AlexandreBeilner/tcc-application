import type { CatalogAdmin, CatalogAsset, CatalogPatch } from '../ports/catalogAdmin'
import type { RecordAdminActionUseCase } from './recordAdminAction'

// Altera os campos permitidos de um ativo do catálogo (N.12). A lista de campos e as regras
// são do motor; aqui só a auditoria, inclusive quando o motor recusa. O patch inteiro vai
// no payload (são só parâmetros de catálogo, nada sensível).
export class UpdateCatalogAssetUseCase {
  constructor(
    private readonly catalogAdmin: CatalogAdmin,
    private readonly recordAdminAction: RecordAdminActionUseCase,
  ) {}

  async execute(adminId: string, assetId: string, patch: CatalogPatch): Promise<CatalogAsset> {
    return this.recordAdminAction.run(
      {
        adminId,
        action: 'catalog.update',
        targetType: 'asset',
        targetId: assetId,
        payload: { ...patch },
      },
      () => this.catalogAdmin.update(assetId, patch, adminId),
    )
  }
}
