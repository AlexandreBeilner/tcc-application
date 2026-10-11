export interface ReferralRepository {
  findCodeByUser(userId: string): Promise<string | null>
  findUserByCode(code: string): Promise<string | null>
  // `false` quando o código já pertence a alguém ou a pessoa já tem um (o chamador relê).
  insertCode(userId: string, code: string): Promise<boolean>
  // `false` quando a conta indicada já tem indicador (uma conta conta uma vez).
  createReferral(referrerId: string, referredId: string): Promise<boolean>
  // Pendente -> válida, uma única vez. Devolve o indicador, ou `null` se não havia pendente.
  qualify(referredId: string, at: Date): Promise<string | null>
  countQualified(referrerId: string): Promise<number>
  countPending(referrerId: string): Promise<number>
}
