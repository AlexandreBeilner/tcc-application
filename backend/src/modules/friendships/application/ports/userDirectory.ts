// Leitura direta de `users` — mesmo banco `gamification`, não é chamada
// entre serviços (mesmo raciocínio do `UserDirectory` de `modules/ranking`,
// 5.5, port própria por módulo em vez de uma compartilhada).
export interface UserSummary {
  id: string
  username: string
  name: string
}

export interface UserDirectory {
  findByUsername(username: string): Promise<UserSummary | undefined>
  findById(id: string): Promise<UserSummary | undefined>
  // Usado por `listFriends`/`listFriendRequests` (achado de revisão da
  // 6.9.1) pra resolver só a página exibida com uma query em vez de uma
  // por amizade.
  findByIds(ids: string[]): Promise<UserSummary[]>
  searchByUsername(query: string, excludeUserId: string): Promise<UserSummary[]>
}
