// Liga uma conta recém-criada a quem a indicou (MO.7.2). Nunca lança por código ruim: o
// cadastro não depende dele.
export interface ReferralAttributor {
  attribute(userId: string, referralCode: unknown): Promise<void>
}
