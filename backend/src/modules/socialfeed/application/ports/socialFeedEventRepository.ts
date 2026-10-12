import type {
  AssemblyFeedData,
  SocialFeedData,
  SocialFeedEvent,
  SocialFeedEventType,
} from '../../domain/socialFeedEvent'

export interface SocialFeedEventRepository {
  record(
    userId: string,
    type: SocialFeedEventType,
    trackNumber: number | null,
    data?: SocialFeedData,
  ): Promise<void>
  // Idempotente por assembleia e pessoa: reexecutar a publicação do resultado não duplica a linha.
  recordAssemblyParticipation(userId: string, data: AssemblyFeedData): Promise<void>
  // Mais recentes primeiro, já limitado no adapter (evita carregar o
  // histórico inteiro de todo o grafo de amigos pra montar uma seção
  // "atividade recente").
  listForUsers(userIds: string[], limit: number): Promise<SocialFeedEvent[]>
}
