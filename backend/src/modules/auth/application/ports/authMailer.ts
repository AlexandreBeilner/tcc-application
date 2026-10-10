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
  // Id do fato (token usado): um aviso por evento.
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
}
