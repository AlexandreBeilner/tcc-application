export interface OutgoingEmail {
  to: string
  subject: string
  html: string
  text: string
  headers?: Record<string, string>
  // Id da linha do outbox: o provedor usa como `Idempotency-Key`, então reenviar depois de um
  // crash entre "enviou" e "marcou enviado" não duplica o e-mail.
  idempotencyKey: string
}

// Transporte (Resend, log, fake). Lança `EmailSendError` com `permanent` correto.
export interface EmailSender {
  send(email: OutgoingEmail): Promise<{ providerMessageId: string }>
}
