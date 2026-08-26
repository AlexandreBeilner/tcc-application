// Leitura direta de `users` — mesmo banco `gamification`, não é chamada
// entre serviços. Port própria do módulo (mesmo raciocínio de `ranking`/
// `friendships`, cada um com a sua, nunca compartilhada). `createdAt` é
// necessário pro baseline de rentabilidade (RNF06 — "resultado consistente
// independente de quando o usuário entrou", mesma lógica de `GetRankingUseCase`).
export interface ProfileUserRecord {
  id: string
  username: string
  createdAt: Date
}

export interface UserDirectory {
  findById(id: string): Promise<ProfileUserRecord | undefined>
}
