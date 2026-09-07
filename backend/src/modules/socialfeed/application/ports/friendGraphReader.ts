// Port própria e mínima sobre `modules/friendships` (G.1), mesmo padrão de
// `modules/ranking`'s `friendGraphReader.ts` — implementada, na composição
// (app.ts), por um adapter em processo sobre `friendshipRepository`. Só
// amizades `accepted`: pedido pendente nunca aparece no feed.
export interface FriendGraphReader {
  listAcceptedFriendIds(userId: string): Promise<string[]>
}
