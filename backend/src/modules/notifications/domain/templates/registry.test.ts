import { describe, expect, it } from 'vitest'
import { EMAIL_TEMPLATES } from './registry'

const ctx = { appUrl: 'https://app.exemplo.com' }

function bodyText(key: string, payload: Record<string, unknown>): string {
  const content = EMAIL_TEMPLATES[key].build(payload, ctx)
  return content.blocks.map((b) => ('text' in b ? b.text : '')).join(' ')
}

describe('avisos de segurança (E4)', () => {
  it('password_changed só afirma o encerramento das sessões quando elas foram encerradas', () => {
    expect(bodyText('password_changed', { name: 'Ana', sessionsEnded: true })).toContain(
      'sessões abertas em outros aparelhos foram encerradas',
    )
    expect(bodyText('password_changed', { name: 'Ana', sessionsEnded: false })).not.toContain(
      'encerradas',
    )
    expect(bodyText('password_changed', { name: 'Ana' })).not.toContain('encerradas')
  })

  it('sessions_ended é de segurança, não revela motivo e não leva token', () => {
    const template = EMAIL_TEMPLATES.sessions_ended
    const content = template.build({ name: 'Ana' }, ctx)

    expect(template.category).toBe('security')
    expect(template.sensitiveFields).toBeUndefined()
    expect(content.subject).toBe('Suas sessões foram encerradas')
    expect(JSON.stringify(content)).not.toContain('token')
    expect(JSON.stringify(content)).not.toContain('—')
  })
})
