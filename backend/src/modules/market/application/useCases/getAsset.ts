import type { AssetDetail, CatalogReader } from '../ports/catalogReader'

export interface GetAssetInput {
  id: string
}

export class GetAssetUseCase {
  constructor(private readonly catalogReader: CatalogReader) {}

  execute(input: GetAssetInput): Promise<AssetDetail> {
    return this.catalogReader.getAsset(input.id)
  }
}
