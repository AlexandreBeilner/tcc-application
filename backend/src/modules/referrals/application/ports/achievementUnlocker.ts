export interface AchievementUnlocker {
  // Reavalia as conquistas da pessoa (a de indicação depende do contador).
  check(userId: string): Promise<void>
}
