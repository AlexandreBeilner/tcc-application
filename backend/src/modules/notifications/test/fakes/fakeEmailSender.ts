import { EmailSendError } from '../../domain/errors'
import type { EmailSender, OutgoingEmail } from '../../application/ports/emailSender'

export interface FakeEmailSender extends EmailSender {
  sent: OutgoingEmail[]
  // Próximas falhas, consumidas uma por chamada (antes de voltar a ter sucesso).
  failNext(...errors: Error[]): void
}

export function createFakeEmailSender(): FakeEmailSender {
  const sent: OutgoingEmail[] = []
  const failures: Error[] = []
  return {
    sent,
    failNext(...errors) {
      failures.push(...errors)
    },
    async send(email) {
      const failure = failures.shift()
      if (failure) throw failure
      sent.push(email)
      return { providerMessageId: `fake-${sent.length}` }
    },
  }
}

export const transientError = (message = 'timeout') => new EmailSendError(message, false)
export const permanentError = (message = 'endereço inválido') => new EmailSendError(message, true)
