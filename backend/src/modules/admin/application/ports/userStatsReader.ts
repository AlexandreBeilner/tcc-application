export interface UserStats {
  total: number
  signups_last_24h: number
  signups_last_7d: number
}

// Contagem de usuários do banco de usuário/gamificação. Conta só quem tem
// role = user (administradores não são "usuários do produto").
export interface UserStatsReader {
  read(now: Date): Promise<UserStats>
}
