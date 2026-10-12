// Quem pode votar e por quê não (MO.6.4). Função pura: o caso de uso junta os fatos e esta regra
// decide. Só PRO ou crédito mensal abrem o voto; quem já votou pode trocar o voto até o fechamento
// sem PRO nem crédito (cancelar o plano nunca desfaz o que a pessoa já fez).
import type { AssemblyParams } from './assembly'

export type VoteDenial =
  'not_open' | 'not_shareholder' | 'email_not_verified' | 'level_too_low' | 'no_credit'

export interface VoteAccessFacts {
  open: boolean
  // Tinha posição na data de corte (a política do kind decide).
  eligible: boolean
  hasVoted: boolean
  isPro: boolean
  emailVerified: boolean
  level: number
  creditsUsedThisMonth: number
}

// Ordem: janela, posição, voto já dado (troca livre), PRO (vota sempre), e só então as exigências
// do crédito gratuito (e-mail verificado, nível mínimo, saldo do mês).
export function resolveVoteAccess(
  facts: VoteAccessFacts,
  params: Pick<AssemblyParams, 'monthlyFreeCredits' | 'freeCreditMinLevel'>,
): VoteDenial | null {
  if (!facts.open) return 'not_open'
  if (!facts.eligible) return 'not_shareholder'
  if (facts.hasVoted || facts.isPro) return null
  if (!facts.emailVerified) return 'email_not_verified'
  if (facts.level < params.freeCreditMinLevel) return 'level_too_low'
  if (facts.creditsUsedThisMonth >= params.monthlyFreeCredits) return 'no_credit'
  return null
}

export function denialMessage(
  reason: VoteDenial,
  params: Pick<AssemblyParams, 'freeCreditMinLevel'>,
): string {
  switch (reason) {
    case 'not_open':
      return 'a votação desta assembleia não está aberta'
    case 'not_shareholder':
      return 'só quem tinha ações da empresa na data de corte participa desta assembleia'
    case 'email_not_verified':
      return 'verifique seu e-mail para usar o crédito de voto'
    case 'level_too_low':
      return `o crédito de voto fica disponível a partir do nível ${params.freeCreditMinLevel}`
    case 'no_credit':
      return 'requer plano PRO ou crédito de voto'
  }
}
