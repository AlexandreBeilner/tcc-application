import { Resend } from 'resend'
import type { EmailSender } from '../../application/ports/emailSender'
import { EmailSendError } from '../../domain/errors'

// Recorte do SDK que o adapter usa: é o que o teste substitui, sem `vi.mock` do pacote. O SDK
// não lança em erro de API, devolve `{ data, error }`.
export interface ResendClient {
  emails: {
    send(
      payload: {
        from: string
        to: string[]
        subject: string
        html: string
        text: string
        replyTo?: string
        headers?: Record<string, string>
      },
      options: { idempotencyKey: string },
    ): Promise<
      | { data: { id: string }; error: null }
      | { data: null; error: { name: string; message: string; statusCode: number | null } }
    >
  }
}

export function createResendClient(apiKey: string): ResendClient {
  return new Resend(apiKey) as unknown as ResendClient
}

// Erros em que repetir a mesma mensagem nunca vai dar certo (payload, remetente ou chave de
// idempotência inválidos). Todo o resto (limite de requisições, cota, 5xx, rede, chave de API
// errada) é transitório: o e-mail volta pra fila e passa a sair assim que o problema some, sem
// perder a mensagem por um erro de configuração que o autor ainda vai corrigir.
const PERMANENT_ERRORS = new Set([
  'validation_error',
  'invalid_from_address',
  'invalid_parameter',
  'missing_required_field',
  'invalid_attachment',
  'invalid_idempotency_key',
  'invalid_idempotent_request',
  'not_found',
  'method_not_allowed',
])

export interface ResendEmailSenderOptions {
  client: ResendClient
  from: string
  replyTo?: string
}

export function createResendEmailSender(options: ResendEmailSenderOptions): EmailSender {
  return {
    async send(email) {
      let response: Awaited<ReturnType<ResendClient['emails']['send']>>
      try {
        response = await options.client.emails.send(
          {
            from: options.from,
            to: [email.to],
            subject: email.subject,
            html: email.html,
            text: email.text,
            replyTo: options.replyTo,
            headers: email.headers,
          },
          // Mesma chave na reentrega depois de um crash: o provedor não duplica o envio.
          { idempotencyKey: email.idempotencyKey },
        )
      } catch (err) {
        // Falha de rede/timeout: o SDK lançou antes de ter resposta.
        throw new EmailSendError(`resend: ${describe(err)}`, false)
      }

      if (response.error) {
        const { name, message } = response.error
        throw new EmailSendError(`resend: ${name}: ${message}`, PERMANENT_ERRORS.has(name))
      }
      return { providerMessageId: response.data.id }
    },
  }
}

function describe(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}
