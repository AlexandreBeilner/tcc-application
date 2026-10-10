export interface BillingUserLookup {
  // Dos ids recebidos (já filtrados como UUID), devolve só os que são usuários nossos.
  existingUserIds(candidateIds: string[]): Promise<string[]>
}
