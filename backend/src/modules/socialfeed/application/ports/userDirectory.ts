// Leitura direta de `users` — mesmo banco `gamification`, port própria por
// módulo em vez de uma compartilhada (mesmo raciocínio de
// `modules/friendships`/`modules/ranking`, 5.5/5.8).
export interface UserSummary {
  id: string
  username: string
  name: string
  avatarUrl: string | null
}

export interface UserDirectory {
  findByIds(ids: string[]): Promise<UserSummary[]>
}
