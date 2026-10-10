import type { CatalogAdmin, NewCatalogAsset, NewCatalogAssetPreview } from '../ports/catalogAdmin'

// Delegação fina (leitura): o que o cadastro criaria, sem gravar e sem auditar.
export class PreviewCatalogAssetUseCase {
  constructor(private readonly catalogAdmin: CatalogAdmin) {}

  async execute(asset: NewCatalogAsset): Promise<NewCatalogAssetPreview> {
    return this.catalogAdmin.preview(asset)
  }
}
