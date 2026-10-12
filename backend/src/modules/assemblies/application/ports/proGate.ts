// Gate de plano PRO: o `ProAccessGuard` do módulo `billing` (nunca claim de JWT). Lança
// `ProRequiredError` quando não há plano ativo, que o `jsonErrorHandler` devolve como
// `403 { error: 'requer plano PRO' }`.
export interface ProGate {
  assertPro(userId: string): Promise<void>
}
