import type { CatalogReader, QuotePoint } from '../ports/catalogReader'

export interface GetAssetQuotesInput {
  id: string
  days?: number
}

export class GetAssetQuotesUseCase {
  constructor(private readonly catalogReader: CatalogReader) {}

  execute(input: GetAssetQuotesInput): Promise<QuotePoint[]> {
    return this.catalogReader.getAssetQuotes(input.id, input.days)
  }
}
