// Situação de uma empresa diante da governança para uma pessoa. Vem do motor (dono das posições e
// do cooldown); nenhum SQL do mercado no Node.
export interface CompanyStanding {
  companyId: string
  name: string
  sector: string
  // A pessoa tem ações da empresa AGORA (não a foto da data de corte).
  holdsShares: boolean
  // Dias simulados que faltam para a empresa poder mudar de novo (0 = livre).
  cooldownDaysLeft: number
}

export interface CompanyStandingReader {
  // `null` se o motor não conhece a empresa.
  get(companyId: string, userId: string): Promise<CompanyStanding | null>
}
