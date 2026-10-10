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

describe('avisos de ciclo de vida (EM.5.1)', () => {
  it('suspensão mostra o motivo e diz como contestar', () => {
    const text = bodyText('account_suspended', { name: 'Ana', reason: 'spam no feed' })

    expect(text).toContain('spam no feed')
    expect(text).toContain('responda a este e-mail')
    expect(EMAIL_TEMPLATES.account_suspended.category).toBe('security')
  })

  it('suspensão sem motivo é recusada na montagem, não vira e-mail vazio', () => {
    expect(() => EMAIL_TEMPLATES.account_suspended.build({ name: 'Ana' }, ctx)).toThrow(/reason/)
  })

  it('exclusão não usa nome nem dado pessoal e pode ser montada com payload vazio', () => {
    const content = EMAIL_TEMPLATES.account_deleted.build({}, ctx)

    expect(content.subject).toBe('Sua conta foi excluída')
    expect(EMAIL_TEMPLATES.account_deleted.category).toBe('security')
  })

  it('boas-vindas apontam para a trilha e o ajuste mostra só o resumo', () => {
    const welcome = EMAIL_TEMPLATES.welcome.build({ name: 'Ana' }, ctx)
    const adjusted = EMAIL_TEMPLATES.account_adjusted.build(
      { name: 'Ana', summary: 'R$ 50,00 foram creditados no seu caixa.' },
      ctx,
    )

    expect(JSON.stringify(welcome)).toContain('https://app.exemplo.com/trilha')
    expect(JSON.stringify(adjusted)).toContain('R$ 50,00 foram creditados')
  })
})

describe('comunicado por e-mail (EM.5.2)', () => {
  const base = {
    name: 'Ana',
    title: 'Manutenção programada',
    body: 'O mercado ficará pausado.',
    kind: 'maintenance',
    startsAt: '2026-10-12T02:00:00.000Z',
    endsAt: '2026-10-12T04:30:00.000Z',
  }

  it('manutenção mostra a janela em horário de Brasília', () => {
    const text = bodyText('announcement', base)

    expect(text).toContain('de 11/10/2026 às 23:00 até 12/10/2026 às 01:30 (horário de Brasília)')
  })

  it('manutenção sem fim diz "a partir de"', () => {
    expect(bodyText('announcement', { ...base, endsAt: null })).toContain(
      'a partir de 11/10/2026 às 23:00',
    )
  })

  it('comunicado comum não mostra janela, e o assunto não ganha prefixo', () => {
    const content = EMAIL_TEMPLATES.announcement.build({ ...base, kind: 'notice' }, ctx)

    expect(bodyText('announcement', { ...base, kind: 'notice' })).not.toContain('Quando')
    expect(content.subject).toBe('Manutenção programada')
  })

  it('título com quebra de linha não quebra o assunto', () => {
    const content = EMAIL_TEMPLATES.announcement.build({ ...base, title: 'Linha 1\nLinha 2' }, ctx)

    expect(content.subject).not.toMatch(/[\r\n]/)
  })

  it('é transacional: aviso crítico não é opcional', () => {
    expect(EMAIL_TEMPLATES.announcement.category).toBe('transactional')
  })
})
