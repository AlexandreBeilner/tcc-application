import type { ProStatusReader } from '../../application/ports/proStatusReader'

// Ponte em processo para o `ProAccessGuard` do `billing` (único jeito de gatear PRO): ele lança
// `ProRequiredError` (reconhecido pelo `code`, sem importar o módulo) quando não há plano ativo.
export function createInProcessProStatus(guard: {
  assertPro(userId: string): Promise<void>
}): ProStatusReader {
  return {
    async isPro(userId) {
      try {
        await guard.assertPro(userId)
        return true
      } catch (err) {
        if ((err as { code?: string }).code === 'PRO_REQUIRED') return false
        throw err
      }
    },
  }
}
