// Fatos da pessoa que o crédito gratuito exige (vêm de `auth` e `gamification`).
export interface VoterProfile {
  level: number
  emailVerified: boolean
}

export interface VoterProfileReader {
  get(userId: string): Promise<VoterProfile>
}
