// Port própria e mínima sobre `modules/friendships` (5.8) — implementada,
// na composição (app.ts), por um adapter em processo sobre
// `ExportFriendshipsUseCase`. Linhas cruas de `friendships` envolvendo o
// usuário, qualquer status/direção — não o formato de UI de
// `ListFriendsUseCase`/`ListFriendRequestsUseCase`.
export interface ExportedFriendship {
  id: string
  requesterId: string
  addresseeId: string
  status: 'pending' | 'accepted' | 'declined'
  createdAt: Date
  respondedAt: Date | null
}

export interface FriendshipsExporter {
  exportForUser(userId: string): Promise<ExportedFriendship[]>
}
