import type { Scoreboard } from '../../domain/scoreboard'

// Cache curto do placar de assembleias abertas: muita gente consulta em polling, e a apuração lê
// todos os votos e o snapshot. Cache fora do ar nunca derruba a leitura (o adapter engole o erro).
export interface ScoreboardCache {
  get(assemblyId: string): Promise<Scoreboard | null>
  set(assemblyId: string, scoreboard: Scoreboard): Promise<void>
}
