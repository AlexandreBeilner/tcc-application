import type { KindPolicies } from './assembly'

export const SHAREHOLDER_KIND = 'shareholder'

function sharesOf(userId: string, snapshot: Parameters<KindPolicies['weightOf']>[1]): number {
  return snapshot.holdings.find((h) => h.userId === userId)?.quantity ?? 0
}

// Assembleia de Acionistas: vota quem tinha posição na data de corte (o motor já exclui os bots
// do snapshot) e o peso é a quantidade de ações nessa data.
export const shareholderPolicies: KindPolicies = {
  isEligible: (userId, snapshot) => sharesOf(userId, snapshot) > 0,
  weightOf: (userId, snapshot) => sharesOf(userId, snapshot),
}
