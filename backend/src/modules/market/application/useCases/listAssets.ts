import type { AssetSummary, CatalogReader } from '../ports/catalogReader'

export interface ListAssetsQuery {
  type?: string
}

// Delegação fina — a regra de filtragem/projeção vive inteira no motor
// (`.docs/engine/catalog.md`). Existe como classe (não uma chamada direta
// à port no router) pelo mesmo motivo de `ListMacroEventsUseCase`
// (`modules/admin`): ponto único de teste isolado da borda HTTP.
export class ListAssetsUseCase {
  constructor(private readonly catalogReader: CatalogReader) {}

  execute(query: ListAssetsQuery): Promise<AssetSummary[]> {
    return this.catalogReader.listAssets(query.type)
  }
}
