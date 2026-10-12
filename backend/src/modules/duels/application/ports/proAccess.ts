// Gate de feature PRO (satisfeito pelo `ProAccessGuard` do módulo `billing`).
export interface ProAccess {
  assertPro(userId: string): Promise<void>
}
