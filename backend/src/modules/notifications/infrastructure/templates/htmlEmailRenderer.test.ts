import { describe, expect, it } from 'vitest'
import type { EmailTemplate } from '../../domain/templates/emailContent'
import { EMAIL_TEMPLATES } from '../../domain/templates/registry'
import { createHtmlEmailRenderer } from './htmlEmailRenderer'

const options = { brandName: 'Investimenta', appUrl: 'https://app.exemplo.com/' }
const renderer = createHtmlEmailRenderer(options)

const optionalTemplate: EmailTemplate = {
  category: 'engagement',
  sample: {},
  build: () => ({
    subject: 'Seu resumo',
    preheader: 'Veja sua semana',
    blocks: [{ type: 'paragraph', text: 'Boa semana!' }],
  }),
}

describe('createHtmlEmailRenderer', () => {
  it('renderiza system_test com HTML, texto e remetente de marca', () => {
    const email = renderer.render('system_test', { name: 'Ana' })

    expect(email.subject).toBe('Teste do gateway de e-mail')
    expect(email.html).toContain('<!doctype html>')
    expect(email.html).toContain('lang="pt-BR"')
    expect(email.html).toContain('prefers-color-scheme: dark')
    expect(email.html).toContain('Investimenta')
    expect(email.html).toContain('Olá, Ana.')
    expect(email.text).toContain('TESTE DE E-MAIL')
    expect(email.text).toContain('https://app.exemplo.com/')
    expect(email.text).not.toMatch(/<[a-z]/i)
  })

  it('escapa o nome vindo do usuário (nada de HTML injetado)', () => {
    const email = renderer.render('system_test', { name: '<script>alert(1)</script>' })

    expect(email.html).not.toContain('<script>')
    expect(email.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
  })

  it('transacional não leva cabeçalho nem link de cancelar inscrição', () => {
    const email = renderer.render('system_test', {})

    expect(email.headers).toBeUndefined()
    expect(email.html).not.toContain('Cancelar inscrição')
    expect(email.text).not.toContain('cancelar a inscrição')
  })

  it('categoria opcional sai com List-Unsubscribe, one-click e link no rodapé', () => {
    const optional = createHtmlEmailRenderer({
      ...options,
      templates: { resumo: optionalTemplate },
    })

    const email = optional.render('resumo', { unsubscribeUrl: 'https://app.exemplo.com/u?t=abc' })

    expect(email.headers).toEqual({
      'List-Unsubscribe': '<https://app.exemplo.com/u?t=abc>',
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    })
    expect(email.html).toContain('Cancelar inscrição')
    expect(email.html).toContain('https://app.exemplo.com/u?t=abc')
    expect(email.text).toContain('https://app.exemplo.com/u?t=abc')
  })

  it('categoria opcional sem unsubscribeUrl falha na renderização', () => {
    const optional = createHtmlEmailRenderer({
      ...options,
      templates: { resumo: optionalTemplate },
    })

    expect(() => optional.render('resumo', {})).toThrow(/unsubscribeUrl/)
    expect(() => optional.render('resumo', { unsubscribeUrl: 'javascript:alert(1)' })).toThrow(
      /protocolo/,
    )
  })

  it('recusa template inexistente', () => {
    expect(() => renderer.render('nao-existe', {})).toThrow(/não existe/)
  })

  it('recusa URL com protocolo perigoso no botão e assunto com quebra de linha', () => {
    const perigoso = createHtmlEmailRenderer({
      ...options,
      templates: {
        link: {
          category: 'transactional',
          sample: {},
          build: () => ({
            subject: 's',
            preheader: 'p',
            blocks: [{ type: 'button', label: 'x', url: 'javascript:alert(1)' }],
          }),
        },
        assunto: {
          category: 'transactional',
          sample: {},
          build: () => ({ subject: 'a\r\nBcc: x@y.com', preheader: 'p', blocks: [] }),
        },
      },
    })

    expect(() => perigoso.render('link', {})).toThrow(/protocolo/)
    expect(() => perigoso.render('assunto', {})).toThrow(/quebra de linha/)
  })

  it('todo template registrado renderiza sem travessão e com versão em texto', () => {
    for (const [key, template] of Object.entries(EMAIL_TEMPLATES)) {
      const payload = { ...template.sample, unsubscribeUrl: 'https://app.exemplo.com/u?t=abc' }
      const email = renderer.render(key, payload)
      expect(email.subject, key).not.toMatch(/[\r\n]/)
      expect(email.html, key).not.toContain('—')
      expect(email.text, key).not.toContain('—')
      expect(email.text.length, key).toBeGreaterThan(20)
    }
  })
})
