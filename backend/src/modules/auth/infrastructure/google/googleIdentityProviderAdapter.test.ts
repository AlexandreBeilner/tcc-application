import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createDisabledGoogleIdentityProvider,
  createGoogleIdentityProvider,
} from './googleIdentityProviderAdapter'

const generateAuthUrl = vi.fn()
const getToken = vi.fn()
const verifyIdToken = vi.fn()

vi.mock('google-auth-library', () => ({
  OAuth2Client: vi.fn().mockImplementation(function OAuth2Client() {
    return { generateAuthUrl, getToken, verifyIdToken }
  }),
}))

const CONFIG = {
  clientId: 'client-id',
  clientSecret: 'client-secret',
  redirectUri: 'http://localhost:8000/auth/google/callback',
}

describe('googleIdentityProviderAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('constrói a URL de autorização com o state informado', () => {
    generateAuthUrl.mockReturnValue('https://accounts.google.com/o/oauth2/v2/auth?state=abc')
    const provider = createGoogleIdentityProvider(CONFIG)

    const url = provider.buildAuthUrl('abc')

    expect(url).toContain('state=abc')
    expect(generateAuthUrl).toHaveBeenCalledWith(
      expect.objectContaining({ scope: ['openid', 'email', 'profile'], state: 'abc' }),
    )
  })

  it('troca o code por perfil do usuário', async () => {
    getToken.mockResolvedValue({ tokens: { id_token: 'fake-id-token' } })
    verifyIdToken.mockResolvedValue({
      getPayload: () => ({ sub: 'google-123', email: 'user@example.com', name: 'Usuário' }),
    })
    const provider = createGoogleIdentityProvider(CONFIG)

    const profile = await provider.exchangeCode('auth-code')

    expect(profile).toEqual({
      providerAccountId: 'google-123',
      email: 'user@example.com',
      name: 'Usuário',
    })
  })

  it('lança erro quando o payload do Google vem incompleto', async () => {
    getToken.mockResolvedValue({ tokens: { id_token: 'fake-id-token' } })
    verifyIdToken.mockResolvedValue({ getPayload: () => ({}) })
    const provider = createGoogleIdentityProvider(CONFIG)

    await expect(provider.exchangeCode('auth-code')).rejects.toThrow()
  })

  it('verifica um idToken recebido direto (SDK nativo) usando o client ID Web como audience', async () => {
    verifyIdToken.mockResolvedValue({
      getPayload: () => ({ sub: 'google-123', email: 'user@example.com', name: 'Usuário' }),
    })
    const provider = createGoogleIdentityProvider(CONFIG)

    const profile = await provider.verifyIdToken('native-id-token')

    expect(profile).toEqual({
      providerAccountId: 'google-123',
      email: 'user@example.com',
      name: 'Usuário',
    })
    expect(verifyIdToken).toHaveBeenCalledWith({
      idToken: 'native-id-token',
      audience: CONFIG.clientId,
    })
    expect(getToken).not.toHaveBeenCalled()
  })

  it('lança erro quando o idToken nativo vem com payload incompleto', async () => {
    verifyIdToken.mockResolvedValue({ getPayload: () => ({}) })
    const provider = createGoogleIdentityProvider(CONFIG)

    await expect(provider.verifyIdToken('native-id-token')).rejects.toThrow()
  })

  it('propaga o erro de assinatura/expiração da lib do Google', async () => {
    verifyIdToken.mockRejectedValue(new Error('Token used too late'))
    const provider = createGoogleIdentityProvider(CONFIG)

    await expect(provider.verifyIdToken('expired-id-token')).rejects.toThrow(/too late/)
  })
})

describe('createDisabledGoogleIdentityProvider', () => {
  it('lança erro claro ao tentar construir a URL de autorização', () => {
    const provider = createDisabledGoogleIdentityProvider()
    expect(() => provider.buildAuthUrl('abc')).toThrow(/não configurado/)
  })

  it('lança erro claro ao tentar trocar o code', async () => {
    const provider = createDisabledGoogleIdentityProvider()
    await expect(provider.exchangeCode('code')).rejects.toThrow(/não configurado/)
  })

  it('lança erro claro ao tentar verificar um idToken', async () => {
    const provider = createDisabledGoogleIdentityProvider()
    await expect(provider.verifyIdToken('token')).rejects.toThrow(/não configurado/)
  })
})
