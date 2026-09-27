import type { SalaryCrediter } from '../../application/ports/salaryCrediter'

// Mesmo padrão de `auth/infrastructure/engine/engineAccountProvisioner.ts` —
// chamada fetch simples, sem reaproveitar o `engineFetch` privado de
// `modules/market` (não é exportado fora do módulo).
export function createEngineSalaryCrediter(engineUrl: string): SalaryCrediter {
  return {
    async credit(userId, amount) {
      const res = await fetch(`${engineUrl}/accounts/${userId}/salary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount }),
      })
      if (!res.ok) {
        throw new Error(`falha ao creditar salário no motor de simulação (status ${res.status})`)
      }
    },
  }
}
