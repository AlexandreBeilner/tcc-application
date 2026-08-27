import type { CatalogReader, CompanyDetail } from '../ports/catalogReader'

export interface GetCompanyInput {
  id: string
}

export class GetCompanyUseCase {
  constructor(private readonly catalogReader: CatalogReader) {}

  execute(input: GetCompanyInput): Promise<CompanyDetail> {
    return this.catalogReader.getCompany(input.id)
  }
}
