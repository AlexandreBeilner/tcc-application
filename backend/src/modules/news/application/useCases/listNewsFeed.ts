import type { NewsFeedQuery, NewsFeedReader, NewsFeedResult } from '../ports/newsFeedReader'

// Delegação fina, mesmo padrão de ListMacroEventsUseCase (admin) — existe
// como classe própria pra manter o caso de uso testável isolado da porta
// HTTP, não porque haja regra de negócio nova aqui.
export class ListNewsFeedUseCase {
  constructor(private readonly newsFeedReader: NewsFeedReader) {}

  async execute(query: NewsFeedQuery): Promise<NewsFeedResult> {
    return this.newsFeedReader.list(query)
  }
}
