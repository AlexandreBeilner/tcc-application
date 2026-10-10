// Só 'track_completed' emitido hoje (backlog engajamento G.1) — tipo é
// texto livre no schema (não enum), então este union type é a única
// checagem de vocabulário fechado que existe no código; um tipo novo
// entra aqui antes de qualquer use case emitir/ler ele.
export type SocialFeedEventType = 'track_completed' | 'duel_won' | 'duel_draw'

// Dados extras de um duelo (MO.5.3), gravados no momento do resultado. Só nomes e o tipo de
// desfecho: nunca valor financeiro (RNF09). `opponentName` fica denormalizado de propósito: o
// feed mostra o que era verdade quando o duelo acabou.
export interface DuelFeedData {
  duelId: string
  opponentUsername: string
  opponentName: string
  // Só o desfecho para quem recebe a linha do feed: nunca expõe quem perdeu como derrota.
  reason: 'profitability' | 'abandonment' | 'tie' | 'both_inactive'
}

export interface SocialFeedEvent {
  id: string
  userId: string
  type: SocialFeedEventType
  // Nullable pelo mesmo motivo do schema: um tipo futuro pode não ter
  // trilha associada.
  trackNumber: number | null
  // Dados extras do tipo (ex: `DuelFeedData`); nulo em `track_completed`.
  data: DuelFeedData | null
  occurredAt: Date
}
