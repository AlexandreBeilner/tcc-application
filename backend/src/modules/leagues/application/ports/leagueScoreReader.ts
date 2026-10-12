import type { LeagueWindow } from '../../domain/league'

export interface LeagueScore {
  userId: string
  level: number
  // Só percentual da janela (RNF09). Nunca patrimônio absoluto.
  profitabilityPct: number
}

export interface LeagueStandings {
  // Ordenado da maior para a menor rentabilidade.
  scores: LeagueScore[]
  updatedAt: Date | null
}

// Pontuação dos membros: rentabilidade percentual da janela do ranking oficial, lida do módulo
// `ranking`. É a única regra de pontuação das ligas.
export interface LeagueScoreReader {
  rank(userIds: string[], window: LeagueWindow): Promise<LeagueStandings>
}
