import type { DuelFeedData, SocialFeedEvent, SocialFeedEventType } from '../../domain/socialFeedEvent'

export interface SocialFeedEventRepository {
  record(
    userId: string,
    type: SocialFeedEventType,
    trackNumber: number | null,
    data?: DuelFeedData,
  ): Promise<void>
  // Mais recentes primeiro, já limitado no adapter (evita carregar o
  // histórico inteiro de todo o grafo de amigos pra montar uma seção
  // "atividade recente").
  listForUsers(userIds: string[], limit: number): Promise<SocialFeedEvent[]>
}
