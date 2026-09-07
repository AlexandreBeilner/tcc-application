// Só 'track_completed' emitido hoje (backlog engajamento G.1) — tipo é
// texto livre no schema (não enum), então este union type é a única
// checagem de vocabulário fechado que existe no código; um tipo novo
// entra aqui antes de qualquer use case emitir/ler ele.
export type SocialFeedEventType = 'track_completed'

export interface SocialFeedEvent {
  id: string
  userId: string
  type: SocialFeedEventType
  // Nullable pelo mesmo motivo do schema: um tipo futuro pode não ter
  // trilha associada.
  trackNumber: number | null
  occurredAt: Date
}
