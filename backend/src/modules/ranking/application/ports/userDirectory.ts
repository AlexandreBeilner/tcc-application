// Leitura direta de `users` — mesmo banco `gamification`, não é chamada
// entre serviços (mesmo raciocínio do `UserDirectory` previsto pra 5.8).
export interface RankingUserRecord {
  id: string
  createdAt: Date
}

export interface UserDirectory {
  listAll(): Promise<RankingUserRecord[]>
}
