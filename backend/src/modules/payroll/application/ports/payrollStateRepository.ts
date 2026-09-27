// Idempotência/catch-up (T.5) — uma linha por usuário, mesmo raciocínio do
// `lastTickAt` do Temporizador no motor (S.3, `scheduler.Config.Plan`).
export interface PayrollStateRepository {
  // `null` = usuário nunca recebeu salário.
  getLastPaidMonth(userId: string): Promise<string | null>
  setLastPaidMonth(userId: string, monthKey: string): Promise<void>
}
