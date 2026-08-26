// Port própria e mínima sobre `modules/friendships` (5.8) — implementada,
// na composição (app.ts), por um adapter em processo sobre
// `ListFriendsUseCase`. Só amizades `accepted` — pedido pendente nunca
// aparece no escopo Amigos (spec 8.3).
export interface FriendGraphReader {
  listAcceptedFriendIds(userId: string): Promise<string[]>
}
