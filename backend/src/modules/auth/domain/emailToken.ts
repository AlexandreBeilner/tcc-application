// Tokens de uso único enviados por e-mail (EM.2.1; verificação de e-mail entra na EM.3.1).
// O token em claro só existe no link do e-mail: o banco guarda apenas o hash (plano 4.4).
export type EmailTokenKind = 'password_reset' | 'email_verification'

export const EMAIL_TOKEN_TTL_MS: Record<EmailTokenKind, number> = {
  password_reset: 30 * 60_000,
  email_verification: 24 * 60 * 60_000,
}

export interface EmailTokenRecord {
  id: string
  userId: string
  kind: EmailTokenKind
  expiresAt: Date
  usedAt: Date | null
}

export type EmailTokenProblem = 'invalid' | 'expired' | 'used'

// Devolve o motivo pelo qual o token não serve, ou `undefined` se ainda vale.
export function emailTokenProblem(
  record: EmailTokenRecord,
  now: Date,
): Exclude<EmailTokenProblem, 'invalid'> | undefined {
  if (record.usedAt !== null) return 'used'
  if (record.expiresAt.getTime() <= now.getTime()) return 'expired'
  return undefined
}
