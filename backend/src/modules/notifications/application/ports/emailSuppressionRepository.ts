import type { SuppressionReason } from '../../domain/suppression'

export interface EmailSuppressionRepository {
  // Endereço já normalizado (minúsculo). `null` = pode receber.
  find(address: string): Promise<SuppressionReason | null>
  // Idempotente. Se já existe, só sobe de gravidade (bounce > complaint > unsubscribe_all),
  // nunca desce: uma reclamação posterior não "perdoa" um bounce.
  add(address: string, reason: SuppressionReason, now: Date): Promise<void>
}
