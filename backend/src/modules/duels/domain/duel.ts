// Decisões do autor (2026-10-10, ponto 046): duelo 1 contra 1, 7 dias, vence a maior rentabilidade
// percentual do período, empate é empate, quem não opera perde por abandono, XP só por
// participar (nunca por vencer), até 3 duelos simultâneos por pessoa.
export const DUEL_DURATION_DAYS = 7
export const MAX_SIMULTANEOUS_DUELS = 3

// Prazo para o desafiado responder; passado isso o desafio expira e libera a vaga de quem desafiou.
export const DUEL_INVITATION_VALID_DAYS = 7

// XP creditado a cada pessoa que de fato participou (operou durante o duelo). Fixo e igual para
// quem ganha, perde ou empata: nunca há incentivo a correr risco para ganhar XP.
export const DUEL_PARTICIPATION_XP = 20

const MS_PER_DAY = 24 * 60 * 60 * 1000

export type DuelStatus = 'pending' | 'active' | 'finished' | 'declined' | 'cancelled' | 'expired'
export type DuelOutcome = 'challenger' | 'opponent' | 'draw'
// profitability: venceu quem rendeu mais; abandonment: só um dos dois operou; tie: mesma
// rentabilidade; both_inactive: nenhum dos dois operou.
export type DuelReason = 'profitability' | 'abandonment' | 'tie' | 'both_inactive'

export interface Duel {
  id: string
  challengerId: string
  opponentId: string
  status: DuelStatus
  createdAt: Date
  expiresAt: Date
  startsAt: Date | null
  endsAt: Date | null
  finishedAt: Date | null
  outcome: DuelOutcome | null
  reason: DuelReason | null
  challengerPct: number | null
  opponentPct: number | null
  challengerOperated: boolean | null
  opponentOperated: boolean | null
  xpAwardedAt: Date | null
}

export interface PlayerResult {
  returnPct: number
  operated: boolean
}

export interface DuelDecision {
  outcome: DuelOutcome
  reason: DuelReason
}

export function invitationExpiry(createdAt: Date): Date {
  return new Date(createdAt.getTime() + DUEL_INVITATION_VALID_DAYS * MS_PER_DAY)
}

export function duelEnd(startsAt: Date): Date {
  return new Date(startsAt.getTime() + DUEL_DURATION_DAYS * MS_PER_DAY)
}

// Rentabilidade comparada com a mesma precisão exibida (2 casas): diferença invisível na tela
// não pode decidir um duelo.
export function samePercent(a: number, b: number): boolean {
  return Math.round(a * 100) === Math.round(b * 100)
}

// Regra única de desfecho. Quem não operou perde por abandono, mesmo que o outro tenha
// rendido negativo (o duelo é sobre participar). Os dois sem operar, ou a mesma rentabilidade,
// terminam em empate.
export function decideDuel(challenger: PlayerResult, opponent: PlayerResult): DuelDecision {
  if (!challenger.operated && !opponent.operated) {
    return { outcome: 'draw', reason: 'both_inactive' }
  }
  if (challenger.operated !== opponent.operated) {
    return {
      outcome: challenger.operated ? 'challenger' : 'opponent',
      reason: 'abandonment',
    }
  }
  if (samePercent(challenger.returnPct, opponent.returnPct)) {
    return { outcome: 'draw', reason: 'tie' }
  }
  return {
    outcome: challenger.returnPct > opponent.returnPct ? 'challenger' : 'opponent',
    reason: 'profitability',
  }
}

// Vaga ocupada de uma pessoa: duelos em andamento (nos dois lados) e desafios que ela fez e ainda
// aguardam resposta. Desafio recebido e não aceito não ocupa vaga de quem recebeu.
export function occupiesSlot(duel: Duel, userId: string): boolean {
  if (duel.status === 'active') return duel.challengerId === userId || duel.opponentId === userId
  if (duel.status === 'pending') return duel.challengerId === userId
  return false
}

export function otherPlayer(duel: Duel, userId: string): string {
  return duel.challengerId === userId ? duel.opponentId : duel.challengerId
}

// Visão de quem olha: ganhou, perdeu ou empatou.
export function viewerOutcome(duel: Duel, userId: string): 'won' | 'lost' | 'draw' | null {
  if (duel.status !== 'finished' || duel.outcome === null) return null
  if (duel.outcome === 'draw') return 'draw'
  const winnerId = duel.outcome === 'challenger' ? duel.challengerId : duel.opponentId
  return winnerId === userId ? 'won' : 'lost'
}
