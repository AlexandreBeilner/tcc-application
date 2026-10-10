import type { AssetSummary, CatalogReader } from '../ports/catalogReader'

export interface ListAssetsQuery {
  type?: string
  // Ativos sandbox (Modo Aprendizado) ficam fora do mercado real por padrão
  // (S.8/achado 023) — só lição e extrato pedem explicitamente.
  includeSandbox?: boolean
}

// Projeção fica no motor (`.docs/engine/catalog.md`); a exclusão de sandbox
// é daqui, porque "o que o mercado real mostra" é decisão de produto do
// backend, e o motor segue devolvendo o catálogo completo. Existe como classe (não uma chamada direta
// à port no router) pelo mesmo motivo de `ListMacroEventsUseCase`
// (`modules/admin`): ponto único de teste isolado da borda HTTP.
export class ListAssetsUseCase {
  constructor(private readonly catalogReader: CatalogReader) {}

  async execute(query: ListAssetsQuery): Promise<AssetSummary[]> {
    const assets = await this.catalogReader.listAssets(query.type)
    return query.includeSandbox ? assets : assets.filter((asset) => !asset.is_sandbox)
  }
}
