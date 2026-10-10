import {
  AdminUserNotFoundError,
  CashCreditOverflowError,
  CashCreditRejectedError,
} from '../../domain/errors'
import type { UserCashCreditor } from '../../application/ports/userCashCreditor'

const REQUEST_TIMEOUT_MS = 4000

async function errorMessage(res: Response, fallback: string): Promise<string> {
  const body = (await res.json().catch(() => ({}))) as { error?: string }
  return body.error ?? fallback
}

// Crédito administrativo no motor (`POST /admin/accounts/{user_id}/credit`, N.17).
// Traduz as recusas do motor pra erros de domínio que o router sabe mapear: 400 valor
// recusado, 404 conta sem registro no motor, 422 saldo estouraria a coluna.
export function createEngineUserCashCreditor(engineUrl: string): UserCashCreditor {
  return {
    async credit(userId, amount) {
      const res = await fetch(`${engineUrl}/admin/accounts/${encodeURIComponent(userId)}/credit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
      if (res.status === 400) {
        throw new CashCreditRejectedError(await errorMessage(res, 'crédito recusado pelo motor'))
      }
      if (res.status === 404) {
        throw new AdminUserNotFoundError(
          await errorMessage(res, 'o usuário não tem conta no motor de simulação'),
        )
      }
      if (res.status === 422) {
        throw new CashCreditOverflowError(
          await errorMessage(res, 'o crédito passa do saldo máximo suportado'),
        )
      }
      if (!res.ok) {
        throw new Error(`falha ao creditar a conta no motor de simulação (status ${res.status})`)
      }
      const body = (await res.json()) as { credited: number }
      return { credited: body.credited }
    },
  }
}
