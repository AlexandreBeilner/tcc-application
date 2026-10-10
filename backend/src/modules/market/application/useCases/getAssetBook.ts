import type { AssetBook, CatalogReader } from '../ports/catalogReader'

export interface GetAssetBookInput {
  id: string
  userId: string
}

export class GetAssetBookUseCase {
  constructor(private readonly catalogReader: CatalogReader) {}

  execute(input: GetAssetBookInput): Promise<AssetBook> {
    return this.catalogReader.getAssetBook(input.id, input.userId)
  }
}
