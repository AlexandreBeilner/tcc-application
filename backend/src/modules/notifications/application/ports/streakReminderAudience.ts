// Quem pode receber o lembrete de sequência (EM.7.3, E13).
export interface StreakReminderCandidate {
  userId: string
  address: string
  name: string
  currentStreak: number
}

export interface StreakReminderAudience {
  // Só conta ativa, com e-mail verificado e engajamento ligado, cuja **última atividade
  // qualificada foi em `lastActivityDay`** (a sequência está de pé e hoje ainda não foi cumprido)
  // e com sequência de pelo menos `minStreak` dias. Páginas por cursor de `userId`.
  listPage(
    afterUserId: string | null,
    limit: number,
    criteria: { lastActivityDay: string; minStreak: number },
  ): Promise<StreakReminderCandidate[]>
}
