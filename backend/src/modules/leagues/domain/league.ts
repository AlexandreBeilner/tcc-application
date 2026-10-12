import { InvalidLeagueNameError } from './errors'

// Decisões do autor (2026-10-10, ponto 046): até 3 ligas abertas por assinante, 20 membros cada.
export const MAX_OPEN_LEAGUES_PER_OWNER = 3
export const MAX_LEAGUE_MEMBERS = 20
// Decisão do autor (2026-10-11, ponto 047): teto de ligas ativas que uma pessoa pode integrar.
export const MAX_JOINED_LEAGUES_PER_USER = 10

export const MIN_LEAGUE_NAME_LENGTH = 3
export const MAX_LEAGUE_NAME_LENGTH = 40

// Janela de pontuação: a mesma do ranking oficial (`ranking/domain/window.ts`). A regra de
// pontuação é fixa: rentabilidade percentual da janela, nunca patrimônio absoluto (RNF09).
export type LeagueWindow = 'week' | 'month'

export type LeagueMemberStatus = 'invited' | 'active'

export interface League {
  id: string
  ownerId: string
  name: string
  window: LeagueWindow
  createdAt: Date
  // Encerramento voluntário pelo dono; libera a vaga das 3 ligas. Nada é apagado.
  closedAt: Date | null
}

export interface LeagueMember {
  leagueId: string
  userId: string
  status: LeagueMemberStatus
  invitedBy: string
  createdAt: Date
  joinedAt: Date | null
}

// Nome sem espaços nas pontas e com espaços internos colapsados.
export function normalizeLeagueName(raw: string): string {
  const name = raw.trim().replace(/\s+/g, ' ')
  if (name.length < MIN_LEAGUE_NAME_LENGTH || name.length > MAX_LEAGUE_NAME_LENGTH) {
    throw new InvalidLeagueNameError(
      `o nome da liga precisa ter entre ${MIN_LEAGUE_NAME_LENGTH} e ${MAX_LEAGUE_NAME_LENGTH} caracteres`,
    )
  }
  return name
}

// Liga arquivada = o dono não é PRO agora. Derivado a cada leitura, nunca gravado: reativar o
// plano devolve a liga sem nenhuma escrita (arquivar, nunca apagar).
export function isLeagueArchived(ownerIsPro: boolean): boolean {
  return !ownerIsPro
}

export function isOpen(league: League): boolean {
  return league.closedAt === null
}
