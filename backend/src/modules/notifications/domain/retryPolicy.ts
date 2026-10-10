// Política de reenvio do worker (plano 4.3): backoff de 1 min, 5 min, 30 min e 2 h, até 5
// tentativas no total. `attemptsMade` é quantas entregas já foram iniciadas (inclui a que acabou
// de falhar); `null` = esgotou, a linha vira `failed`.
export const MAX_DELIVERY_ATTEMPTS = 5
const RETRY_DELAYS_MS = [60_000, 5 * 60_000, 30 * 60_000, 2 * 60 * 60_000]

export function nextRetryDelayMs(attemptsMade: number): number | null {
  if (attemptsMade >= MAX_DELIVERY_ATTEMPTS) return null
  return RETRY_DELAYS_MS[Math.max(attemptsMade, 1) - 1]
}
