// Quem pode votar e por quê não (MO.6.4). Função pura: o caso de uso junta os fatos e esta regra
// decide. Vota quem tinha posição na data de corte, enquanto a votação está aberta; quem já votou
// pode trocar o voto até o fechamento.

export type VoteDenial = 'not_open' | 'not_shareholder'

export interface VoteAccessFacts {
  open: boolean
  // Tinha posição na data de corte (a política do kind decide).
  eligible: boolean
}

// Ordem: janela, depois posição.
export function resolveVoteAccess(facts: VoteAccessFacts): VoteDenial | null {
  if (!facts.open) return 'not_open'
  if (!facts.eligible) return 'not_shareholder'
  return null
}

export function denialMessage(reason: VoteDenial): string {
  switch (reason) {
    case 'not_open':
      return 'a votação desta assembleia não está aberta'
    case 'not_shareholder':
      return 'só quem tinha ações da empresa na data de corte participa desta assembleia'
  }
}
