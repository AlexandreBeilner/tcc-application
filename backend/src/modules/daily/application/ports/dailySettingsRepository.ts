export interface DailySettings {
  // YYYY-MM-DD; nulo = Diário desligado.
  startDate: string | null
  updatedBy: string | null
  updatedAt: Date
}

export interface DailySettingsRepository {
  get(): Promise<DailySettings>
  setStartDate(startDate: string | null, updatedBy: string, now: Date): Promise<void>
}
