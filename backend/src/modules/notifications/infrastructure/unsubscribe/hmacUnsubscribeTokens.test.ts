import { describe, expect, it } from 'vitest'
import { createHmacUnsubscribeTokens, createUnsubscribeLinks } from './hmacUnsubscribeTokens'

const USER = '0b8f7a52-1c1e-4a55-9a64-6f3c2d1b9e10'

describe('token de cancelamento (HMAC)', () => {
  const tokens = createHmacUnsubscribeTokens('segredo-de-teste')

  it('verifica o que emitiu', () => {
    const token = tokens.issue({ userId: USER, category: 'social' })
    expect(tokens.verify(token)).toEqual({ userId: USER, category: 'social' })
  })

  it('só usa caracteres seguros em URL e fragmento', () => {
    expect(tokens.issue({ userId: USER, category: 'engagement' })).toMatch(/^[A-Za-z0-9._-]+$/)
  })

  it('recusa assinatura de outra chave', () => {
    const other = createHmacUnsubscribeTokens('outro-segredo')
    expect(tokens.verify(other.issue({ userId: USER, category: 'social' }))).toBeNull()
  })

  it('recusa trocar a categoria ou o usuário mantendo a assinatura', () => {
    const [user, , signature] = tokens.issue({ userId: USER, category: 'social' }).split('.')
    expect(tokens.verify(`${user}.engagement.${signature}`)).toBeNull()
    expect(tokens.verify(`${USER.replace('0b8f', '1b8f')}.social.${signature}`)).toBeNull()
  })

  it.each(['', 'lixo', 'a.b', `${USER}.marketing.abc`, `${USER}.social.`, `${USER}.social.%%%`])(
    'recusa token malformado %j',
    (token) => {
      expect(tokens.verify(token)).toBeNull()
    },
  )

  it('o link usa a base da API sem barra sobrando', () => {
    const links = createUnsubscribeLinks(tokens, 'https://api.exemplo.com/')
    const url = links.build({ userId: USER, category: 'social' })
    expect(url.startsWith('https://api.exemplo.com/email/unsubscribe?token=')).toBe(true)
    expect(tokens.verify(new URL(url).searchParams.get('token') ?? '')).toEqual({
      userId: USER,
      category: 'social',
    })
  })
})
