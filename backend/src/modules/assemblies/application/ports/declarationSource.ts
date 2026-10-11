// Declaração de dividendo retida no motor enquanto a assembleia de destinação do lucro decide
// (MO.6.11 e MO.6.13). O motor é dono da declaração; o backend só a vê, abre a assembleia e pede a
// liberação quando a pauta não vai decidir nada.
export interface PendingDeclaration {
  id: string
  companyId: string
  name: string
  sector: string
  tickers: string[]
  // Dia simulado do balanço que gerou a declaração (o mesmo `reportDay` de `CompanyReportFact`).
  reportDay: number
  // Há quantos dias simulados está retida, e quando sai sozinha (prazo de segurança do motor).
  daysHeld: number
  safetyDeadlineDay: number
  // Assembleia cuja decisão já foi ligada a ela, e se a liberação já foi pedida.
  decisionAssemblyId: string | null
  releaseRequested: boolean
}

export interface DeclarationSource {
  // Declarações retidas agora. Lança se o motor não responde: abrir uma assembleia comum para o
  // mesmo balanço antes de saber se há declaração retida tomaria o lugar da de destinação.
  listPending(): Promise<PendingDeclaration[]>
  // Pede a liberação (o dividendo sai no próximo tick, com o payout vigente). Idempotente:
  // declaração que já saiu não é erro.
  release(id: string, reason: 'no_decision' | 'admin'): Promise<void>
}
