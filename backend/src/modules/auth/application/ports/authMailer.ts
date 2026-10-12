// E-mails que o `auth` dispara. Quem implementa (`infrastructure/notifications/`) monta o link
// e enfileira no módulo `notifications`; o `auth` não conhece o provedor nem o outbox.
export interface PasswordResetMail {
  userId: string
  to: string
  name: string
  // Token em claro, só pra montar o link (fragmento da URL). Nunca é gravado como está.
  token: string
  // Id do registro do token: chave de idempotência do e-mail.
  tokenId: string
  expiresAt: Date
}

export interface PasswordChangedMail {
  userId: string
  to: string
  name: string
  // Id do fato (token usado, ou id gerado a cada troca): um aviso por evento.
  eventId: string
  // Reset encerra as outras sessões; a troca de senha com a sessão aberta não. O texto muda.
  sessionsEnded: boolean
}

export interface SessionsEndedMail {
  userId: string
  to: string
  name: string
  // Id do fato (um por "forçar logout"): um aviso por evento.
  eventId: string
}

export interface EmailVerificationMail {
  userId: string
  to: string
  name: string
  // Token em claro, só pra montar o link (fragmento da URL). Nunca é gravado como está.
  token: string
  // Id do registro do token: chave de idempotência do e-mail.
  tokenId: string
  expiresAt: Date
}

export interface AuthMailer {
  sendEmailVerification(mail: EmailVerificationMail): Promise<void>
  sendPasswordReset(mail: PasswordResetMail): Promise<void>
  sendPasswordChanged(mail: PasswordChangedMail): Promise<void>
  sendSessionsEnded(mail: SessionsEndedMail): Promise<void>
}
