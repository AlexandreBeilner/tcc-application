import { decorateWithSeen } from '../../domain/decorateSeen'
import type { NewsFeedQuery, NewsFeedReader } from '../ports/newsFeedReader'
import type { NewsReadRepository } from '../ports/newsReadRepository'

export interface ListNewsFeedInput extends NewsFeedQuery {
  userId: string
}

// `NewsFeedReader` devolve o item cru do motor (sem noção de usuário) —
// `seen` é decidido aqui, cruzando com `NewsReadRepository` (tarefa 6.6.2).
export type NewsEvent = Awaited<ReturnType<NewsFeedReader['list']>>['events'][number] & {
  seen: boolean
}

export interface ListNewsFeedResult {
  events: NewsEvent[]
}

export class ListNewsFeedUseCase {
  constructor(
    private readonly newsFeedReader: NewsFeedReader,
    private readonly newsReadRepository: NewsReadRepository,
  ) {}

  async execute(input: ListNewsFeedInput): Promise<ListNewsFeedResult> {
    const { userId, ...query } = input
    const { events } = await this.newsFeedReader.list(query)
    const seenEventIds = await this.newsReadRepository.listSeenEventIds(
      userId,
      events.map((event) => event.id),
    )
    return { events: decorateWithSeen(events, seenEventIds) }
  }
}
