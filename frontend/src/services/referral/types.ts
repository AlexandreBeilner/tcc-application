// Espelha `.docs/backend/referrals.md`.
export interface ReferralMilestone {
    threshold: number
    rewardDays: number
    // Alcançado pelas indicações válidas; `granted` só vira verdadeiro quando o PRO foi concedido.
    reached: boolean
    granted: boolean
}

export interface MyReferral {
    code: string
    // Amigos que concluíram a primeira lição (o que vale).
    qualifiedCount: number
    // Amigos que entraram pelo link e ainda não concluíram a primeira lição.
    pendingCount: number
    next: { threshold: number; rewardDays: number; remaining: number }
    milestones: ReferralMilestone[]
}
