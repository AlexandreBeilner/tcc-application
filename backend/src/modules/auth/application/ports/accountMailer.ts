// E-mails de ciclo de vida da conta (EM.5.1). Separada de `AuthMailer` (credenciais e verificação)
// só por assunto; quem implementa (`infrastructure/notifications/`) enfileira no módulo
// `notifications`. Usada também pelo `admin`, que já depende das ports do `auth`.
interface AccountRecipient {
  userId: string
  to: string
  name: string
}

// Um id por fato, só para a chave de idempotência: o mesmo fato nunca envia duas vezes.
interface AccountEvent extends AccountRecipient {
  eventId: string
}

export type WelcomeMail = AccountRecipient

export interface AccountSuspendedMail extends AccountEvent {
  // Motivo registrado pelo admin: é mostrado a quem foi suspenso.
  reason: string
}

export type AccountReactivatedMail = AccountEvent

export type DataExportedMail = AccountEvent

// Sem nome: o e-mail de exclusão não repete dado pessoal no payload do outbox.
export interface AccountDeletedMail {
  userId: string
  to: string
  eventId: string
}

export interface AccountAdjustedMail extends AccountEvent {
  // Frase pronta, sem o motivo interno do admin (ex.: "R$ 50,00 foram creditados no seu caixa").
  summary: string
}

export interface AccountMailer {
  sendWelcome(mail: WelcomeMail): Promise<void>
  sendAccountSuspended(mail: AccountSuspendedMail): Promise<void>
  sendAccountReactivated(mail: AccountReactivatedMail): Promise<void>
  sendAccountDeleted(mail: AccountDeletedMail): Promise<void>
  sendDataExported(mail: DataExportedMail): Promise<void>
  sendAccountAdjusted(mail: AccountAdjustedMail): Promise<void>
}
