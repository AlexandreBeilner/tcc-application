import type { EmailTokenKind, EmailTokenRecord } from '../../domain/emailToken'

export interface NewEmailToken {
  userId: string
  kind: EmailTokenKind
  tokenHash: string
  expiresAt: Date
}

export interface AuthEmailTokenRepository {
  // Invalida (marca como usados) os tokens ainda abertos do mesmo usuário e tipo e grava o novo,
  // na mesma transação: pedir outro link anula o anterior.
  replaceActive(input: NewEmailToken, now: Date): Promise<{ id: string }>
  findByHash(tokenHash: string, kind: EmailTokenKind): Promise<EmailTokenRecord | undefined>
  // Consumo atômico: `true` só para quem de fato marcou `used_at` (duas requisições simultâneas
  // com o mesmo token nunca passam as duas).
  markUsed(id: string, now: Date): Promise<boolean>
}
