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

describe('e-mails de amizade (EM.6.2)', () => {
  const payload = { name: 'Ana', friendUsername: 'bia_invest', level: 12, returnPct: 3.2 }

  it('são sociais (opt-in) e levam só username, nível e percentual com sinal, em pt-BR', () => {
    const received = EMAIL_TEMPLATES.friend_request_received
    const text = bodyText('friend_request_received', payload)

    expect(received.category).toBe('social')
    expect(EMAIL_TEMPLATES.friend_request_accepted.category).toBe('social')
    expect(received.build(payload, ctx).subject).toBe('bia_invest enviou um pedido de amizade')
    expect(text).toContain('bia_invest está no nível 12 e teve rentabilidade de +3,2% na semana.')
    expect(JSON.stringify(received.build(payload, ctx))).toContain(
      'https://app.exemplo.com/amigos/solicitacoes',
    )
  })

  it('o percentual negativo mantém o sinal e o aceite aponta para a lista de amigos', () => {
    const content = EMAIL_TEMPLATES.friend_request_accepted.build(
      { ...payload, returnPct: -1.4 },
      ctx,
    )

    expect(content.subject).toBe('bia_invest aceitou seu pedido de amizade')
    expect(JSON.stringify(content)).toContain('rentabilidade de -1,4% na semana')
    expect(JSON.stringify(content)).toContain('https://app.exemplo.com/amigos')
  })

  it('rentabilidade zero sai sem sinal', () => {
    expect(bodyText('friend_request_received', { ...payload, returnPct: 0 })).toContain(
      'rentabilidade de 0,0% na semana',
    )
  })

  it('sem nível e percentual, a frase de estatísticas some em vez de sair quebrada', () => {
    const text = bodyText('friend_request_received', { name: 'Ana', friendUsername: 'bia_invest' })

    expect(text).not.toContain('nível')
    expect(text).not.toContain('undefined')
  })

  it('sem o username de quem pediu, recusa montar', () => {
    expect(() => EMAIL_TEMPLATES.friend_request_received.build({ name: 'Ana' }, ctx)).toThrow(
      /friendUsername/,
    )
  })

  it('nenhum texto usa travessão', () => {
    expect(
      JSON.stringify(EMAIL_TEMPLATES.friend_request_received.build(payload, ctx)),
    ).not.toContain('—')
    expect(
      JSON.stringify(EMAIL_TEMPLATES.friend_request_accepted.build(payload, ctx)),
    ).not.toContain('—')
  })
})

describe('resumo semanal (EM.7.1)', () => {
  const template = EMAIL_TEMPLATES.weekly_digest

  it('é de engajamento (opt-in) e só carrega nível, percentual e missão', () => {
    const text = bodyText('weekly_digest', template.sample)

    expect(template.category).toBe('engagement')
    expect(text).toContain('nível 12')
    expect(text).toContain('+2,4%')
    expect(text).toContain('Conclua uma lição e mais 1')
    expect(text).not.toContain('R$')
    expect(text).not.toContain('—')
  })

  it('rentabilidade negativa não vira número nem palavra de perda', () => {
    const text = bodyText('weekly_digest', { ...template.sample, weeklyReturnPct: -3.1 })

    expect(text).not.toContain('3,1')
    expect(text).not.toMatch(/perd|prejuízo|queda/i)
    expect(text).toContain('O mercado se mexeu')
  })

  it('sem ranking e sem missão pendente, só o essencial', () => {
    const text = bodyText('weekly_digest', { name: 'Ana', level: 3, pendingMissions: 0 })

    expect(text).toContain('nível 3')
    expect(text).not.toContain('rentabilidade')
    expect(text).not.toContain('missão')
  })
})

describe('avisos de engajamento do EM.7.2', () => {
  it('salário de um mês: valor em reais, mês por extenso, sem travessão', () => {
    const template = EMAIL_TEMPLATES.salary_credited
    const text = bodyText('salary_credited', template.sample)

    expect(template.category).toBe('engagement')
    expect(text).toContain('de outubro de 2026')
    expect(text).toContain('R$ 1.000,00')
    expect(text).not.toContain('—')
  })

  it('catch-up de vários meses vira um e-mail só, com o total', () => {
    const text = bodyText('salary_credited', {
      name: 'Ana',
      firstMonth: '2026-08',
      lastMonth: '2026-10',
      months: 3,
      amountPerMonth: 500,
    })

    expect(text).toContain('de agosto de 2026 a outubro de 2026')
    expect(text).toContain('3 meses de R$ 500,00')
    expect(text).toContain('R$ 1.500,00 no total')
  })

  it('salário sem valor é recusado na montagem', () => {
    expect(() => EMAIL_TEMPLATES.salary_credited.build({ name: 'Ana' }, ctx)).toThrow(
      /amountPerMonth/,
    )
  })

  it('conquista rara leva só nome e descrição da conquista, nunca contagem de quem a tem', () => {
    const template = EMAIL_TEMPLATES.rare_achievement
    const content = template.build(template.sample, ctx)
    const text = bodyText('rare_achievement', template.sample)

    expect(template.category).toBe('engagement')
    expect(content.subject).toBe('Você desbloqueou a conquista Fiel')
    expect(text).toContain('30 dias seguidos de atividade.')
    expect(text).not.toMatch(/\d+%|\d+ pessoas/)
    expect(JSON.stringify(content)).not.toContain('—')
  })
})

describe('lembrete de sequência (EM.7.3)', () => {
  const template = EMAIL_TEMPLATES.streak_reminder

  it('é um convite: fato + pergunta, sem escassez, culpa nem contagem regressiva', () => {
    const content = template.build(template.sample, ctx)
    const text = bodyText('streak_reminder', template.sample)

    expect(template.category).toBe('engagement')
    expect(content.subject).toBe('Sua sequência de 12 dias segue de pé')
    expect(text).toContain('segue de pé até as 21h de hoje')
    expect(text).toContain('Quer fazer uma lição rápida?')
    expect(JSON.stringify(content)).not.toMatch(
      /perd|última chance|corra|urgente|não deixe|desperdi|falta pouco|restam|—/i,
    )
  })

  it('sem o tamanho da sequência é recusado na montagem', () => {
    expect(() => template.build({ name: 'Ana' }, ctx)).toThrow(/streak/)
  })
})
