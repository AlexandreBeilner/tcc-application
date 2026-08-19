import { OAuth2Client } from 'google-auth-library'
import type {
  GoogleIdentityProvider,
  GoogleProfile,
} from '../../application/ports/googleIdentityProvider'

export interface GoogleOAuthConfig {
  clientId: string
  clientSecret: string
  redirectUri: string
}

export function createGoogleIdentityProvider(config: GoogleOAuthConfig): GoogleIdentityProvider {
  const client = new OAuth2Client(config)

  return {
    buildAuthUrl(state) {
      return client.generateAuthUrl({
        access_type: 'online',
        scope: ['openid', 'email', 'profile'],
        state,
      })
    },

    async exchangeCode(code) {
      const { tokens } = await client.getToken(code)
      if (!tokens.id_token) {
        throw new Error('id_token ausente na resposta do Google')
      }

      const ticket = await client.verifyIdToken({
        idToken: tokens.id_token,
        audience: config.clientId,
      })
      const payload = ticket.getPayload()
      if (!payload?.sub || !payload.email) {
        throw new Error('payload do Google incompleto')
      }

      const profile: GoogleProfile = {
        providerAccountId: payload.sub,
        email: payload.email,
        name: payload.name ?? payload.email,
      }
      return profile
    },
  }
}

// Usado quando GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI não estão configurados
// (ex: dev local sem credenciais do Google Cloud Console) — mantém a rota
// presente, mas com um erro claro em vez de a aplicação falhar ao subir.
export function createDisabledGoogleIdentityProvider(): GoogleIdentityProvider {
  const error = () => {
    throw new Error(
      'login com Google não configurado (defina GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI)',
    )
  }
  return {
    buildAuthUrl: error,
    exchangeCode: async () => error(),
  }
}
