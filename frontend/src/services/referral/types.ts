// Espelha `.docs/backend/referrals.md`.
export interface MyReferral {
    code: string
    // Amigos que concluíram a primeira lição (o que vale).
    qualifiedCount: number
    // Amigos que entraram pelo link e ainda não concluíram a primeira lição.
    pendingCount: number
}
