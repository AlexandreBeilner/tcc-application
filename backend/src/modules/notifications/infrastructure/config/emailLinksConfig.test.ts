import { describe, expect, it } from 'vitest'
import { loadEmailLinksConfig } from './emailLinksConfig'

describe('loadEmailLinksConfig', () => {
  it('sem nada configurado, usa os padrões de desenvolvimento', () => {
    expect(loadEmailLinksConfig({})).toEqual({
      unsubscribeSecret: 'dev-secret-troque-em-producao',
      apiBaseUrl: 'http://localhost:8000',
      frontendUrl: 'http://localhost:5173',
    })
  })

  it('o segredo próprio vence o do JWT, que serve de reserva', () => {
    expect(loadEmailLinksConfig({ JWT_SECRET: 'jwt' }).unsubscribeSecret).toBe('jwt')
    expect(
      loadEmailLinksConfig({ JWT_SECRET: 'jwt', EMAIL_UNSUBSCRIBE_SECRET: 'proprio' })
        .unsubscribeSecret,
    ).toBe('proprio')
  })

  it('lê as URLs públicas', () => {
    const config = loadEmailLinksConfig({
      PUBLIC_API_URL: 'https://api.exemplo.com',
      FRONTEND_URL: 'https://app.exemplo.com',
    })
    expect(config).toMatchObject({
      apiBaseUrl: 'https://api.exemplo.com',
      frontendUrl: 'https://app.exemplo.com',
    })
  })
})
