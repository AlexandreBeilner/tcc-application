// Registra que a pessoa teve atividade qualificadora num dia (MO.5.4). Idempotente por (pessoa, dia).
export interface ActivityDayRecorder {
  record(userId: string, day: string): Promise<void>
}
