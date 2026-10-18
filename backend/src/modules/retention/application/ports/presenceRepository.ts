export interface PresenceRepository {
  // Idempotente: o mesmo (pessoa, dia) gravado duas vezes não duplica nem falha.
  record(userId: string, day: string): Promise<void>
}
