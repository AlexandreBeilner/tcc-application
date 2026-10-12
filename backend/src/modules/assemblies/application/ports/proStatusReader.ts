// "Esta pessoa é PRO agora?" Satisfeito pelo `ProAccessGuard` do módulo `billing` (nunca por claim
// de JWT): o cancelamento vale na hora.
export interface ProStatusReader {
  isPro(userId: string): Promise<boolean>
}
