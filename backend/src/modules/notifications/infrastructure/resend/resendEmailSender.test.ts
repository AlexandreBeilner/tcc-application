import { describe, expect, it } from 'vitest'
import { EmailSendError } from '../../domain/errors'
import { createResendEmailSender, type ResendClient } from './resendEmailSender'

const email = {
  stream: 'transactional' as const,
  to: 'ana@exemplo.com',
  subject: 'Assunto',
  html: '<p>oi</p>',
  text: 'oi',
  headers: { 'List-Unsubscribe': '<https://x>' },
  idempotencyKey: 'linha-1',
}

function clientReturning(response: Awaited<ReturnType<ResendClient['emails']['send']>>) {
  const calls: Parameters<ResendClient['emails']['send']>[] = []
  const client: ResendClient = {
    emails: {
      async send(payload, options) {
        calls.push([payload, options])
        return response
      },
    },
  }
  return { client, calls }
}

const oneStream = (client: ResendClient) => ({
  streams: { transactional: { client, from: 'a@b.com' }, news: { client, from: 'a@b.com' } },
})

const apiError = (name: string, statusCode: number | null = 400) => ({
  data: null,
  error: { name, message: `msg ${name}`, statusCode },
})

describe('createResendEmailSender', () => {
  it('envia com remetente, destinatário, reply-to, cabeçalhos e Idempotency-Key', async () => {
    const { client, calls } = clientReturning({ data: { id: 'msg_1' }, error: null })
    const sender = createResendEmailSender({
      streams: {
        transactional: { client, from: 'Plataforma <no-reply@send.exemplo.com>' },
        news: { client: clientReturning({ data: { id: 'x' }, error: null }).client, from: 'a@b.com' },
      },
      replyTo: 'ajuda@exemplo.com',
    })

    const result = await sender.send(email)

    expect(result).toEqual({ providerMessageId: 'msg_1' })
    expect(calls).toEqual([
      [
        {
          from: 'Plataforma <no-reply@send.exemplo.com>',
          to: ['ana@exemplo.com'],
          subject: 'Assunto',
          html: '<p>oi</p>',
          text: 'oi',
          replyTo: 'ajuda@exemplo.com',
          headers: { 'List-Unsubscribe': '<https://x>' },
        },
        { idempotencyKey: 'linha-1' },
      ],
    ])
  })

  it.each([
    'validation_error',
    'invalid_from_address',
    'invalid_parameter',
    'invalid_idempotent_request',
  ])('%s é erro permanente', async (name) => {
    const { client } = clientReturning(apiError(name))
    const sender = createResendEmailSender(oneStream(client))

    const error = await sender.send(email).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(EmailSendError)
    expect(error).toMatchObject({ permanent: true })
    expect((error as Error).message).toContain(name)
  })

  it.each([
    ['rate_limit_exceeded', 429],
    ['daily_quota_exceeded', 429],
    ['monthly_quota_exceeded', 429],
    ['internal_server_error', 500],
    ['application_error', 500],
    ['concurrent_idempotent_requests', 409],
    ['invalid_api_key', 403],
    ['restricted_api_key', 401],
  ])('%s (%s) é transitório', async (name, status) => {
    const { client } = clientReturning(apiError(name, status))
    const sender = createResendEmailSender(oneStream(client))

    await expect(sender.send(email)).rejects.toMatchObject({ permanent: false })
  })

  it('exceção do SDK (rede) é transitória', async () => {
    const client: ResendClient = {
      emails: {
        async send() {
          throw new Error('fetch failed')
        },
      },
    }
    const sender = createResendEmailSender(oneStream(client))

    const error = await sender.send(email).catch((e: unknown) => e)

    expect(error).toMatchObject({ permanent: false })
    expect((error as Error).message).toContain('fetch failed')
  })

  it('usa a chave e o remetente do fluxo do e-mail, sem misturar', async () => {
    const transactional = clientReturning({ data: { id: 't1' }, error: null })
    const news = clientReturning({ data: { id: 'n1' }, error: null })
    const sender = createResendEmailSender({
      streams: {
        transactional: { client: transactional.client, from: 'Selucra <no-reply@send.exemplo.com>' },
        news: { client: news.client, from: 'Selucra <no-reply@news.exemplo.com>' },
      },
      replyTo: 'suporte@exemplo.com',
    })

    await sender.send(email)
    await sender.send({ ...email, stream: 'news' })

    expect(transactional.calls).toHaveLength(1)
    expect(transactional.calls[0][0].from).toBe('Selucra <no-reply@send.exemplo.com>')
    expect(news.calls).toHaveLength(1)
    expect(news.calls[0][0].from).toBe('Selucra <no-reply@news.exemplo.com>')
    expect(news.calls[0][0].replyTo).toBe('suporte@exemplo.com')
  })
})
