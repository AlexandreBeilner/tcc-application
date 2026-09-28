// Espelha `.docs/backend/gamification.md`.
export interface Progression {
    userId: string
    xp: number
    level: number
    currentStreak: number
    longestStreak: number
    lastQualifyingActivityDate: string | null
    monthlySalary: number
}

export interface Streak {
    currentStreak: number
    longestStreak: number
}
