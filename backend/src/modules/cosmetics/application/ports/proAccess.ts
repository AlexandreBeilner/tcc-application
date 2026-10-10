// Gate de feature PRO (satisfeito pelo `ProAccessGuard` do módulo `billing`): lança erro com
// `code: 'PRO_REQUIRED'` quando a pessoa não tem plano ativo.
export interface ProAccess {
  assertPro(userId: string): Promise<void>
}
