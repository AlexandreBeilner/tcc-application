import { describe, expect, it } from 'vitest'
import { createLogEmailSender } from './logEmailSender'

describe('createLogEmailSender', () => {
  it('imprime destinatário, assunto e o texto, e devolve um id derivado da chave', async () => {
    const lines: string[] = []
    const sender = createLogEmailSender(
      { transactional: 'Plataforma <no-reply@send.localhost>', news: 'Plataforma <no-reply@news.localhost>' },
      (l) => lines.push(l),
    )

    const result = await sender.send({
      stream: 'news',
      to: 'ana@exemplo.com',
      subject: 'Redefinir senha',
      html: '<p>x</p>',
      text: 'Abra o link:\nhttp://localhost:5173/redefinir-senha#token=abc',
      headers: { 'X-Teste': '1' },
      idempotencyKey: 'id-1',
    })

    expect(result).toEqual({ providerMessageId: 'log-id-1' })
    expect(lines).toHaveLength(1)
    expect(lines[0]).toContain('de: Plataforma <no-reply@news.localhost>')
    expect(lines[0]).toContain('para: ana@exemplo.com')
    expect(lines[0]).toContain('assunto: Redefinir senha')
    expect(lines[0]).toContain('X-Teste: 1')
    expect(lines[0]).toContain('redefinir-senha#token=abc')
  })
})
