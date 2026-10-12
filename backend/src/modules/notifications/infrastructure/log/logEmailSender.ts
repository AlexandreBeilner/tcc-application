import type { EmailSender } from '../../application/ports/emailSender'
import type { EmailStream } from '../../domain/emailMessage'

// Transporte de desenvolvimento (`EMAIL_PROVIDER=log`): imprime o e-mail em vez de enviar, pra
// testar recuperação de senha e verificação sem provedor. O corpo inclui os links com token:
// nunca ligar fora de desenvolvimento.
export function createLogEmailSender(
  from: Record<EmailStream, string>,
  log: (line: string) => void = console.log,
): EmailSender {
  let counter = 0
  return {
    async send(email) {
      counter += 1
      log(
        [
          `e-mail (log, não enviado de verdade) #${counter}`,
          `  de: ${from[email.stream]}`,
          `  para: ${email.to}`,
          `  assunto: ${email.subject}`,
          ...(email.headers
            ? Object.entries(email.headers).map(([name, value]) => `  ${name}: ${value}`)
            : []),
          '  ---',
          ...email.text.split('\n').map((line) => `  ${line}`),
          '  ---',
        ].join('\n'),
      )
      return { providerMessageId: `log-${email.idempotencyKey}` }
    },
  }
}
