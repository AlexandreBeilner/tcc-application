import type { CatalogAdmin, CatalogAsset } from '../ports/catalogAdmin'

// Delegação fina (leitura): o catálogo inteiro, com o que cada ativo permite editar.
export class ListAdminCatalogUseCase {
  constructor(private readonly catalogAdmin: CatalogAdmin) {}

  async execute(): Promise<CatalogAsset[]> {
    return this.catalogAdmin.list()
  }
}
