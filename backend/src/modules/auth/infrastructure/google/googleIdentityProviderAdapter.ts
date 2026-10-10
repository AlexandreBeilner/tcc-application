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

  // O `audience` é sempre o client ID Web (`config.clientId`), tanto pro
  // idToken obtido via redirect (exchangeCode) quanto pro idToken que o SDK
  // nativo do app manda direto (verifyIdToken) — o
  // `@react-native-google-signin/google-signin` emite o idToken com
  // `aud` = o `webClientId` passado em `GoogleSignin.configure()`, nunca o
  // client ID Android/iOS (ver `.claude/runbook-mudanca-identidade-app-conta-google.md`,
  // seção 0). Os client IDs Android/iOS só autenticam o app nativo junto ao
  // Google (pacote+SHA-1/bundle ID), não entram aqui.
  async function verifyAndBuildProfile(idToken: string): Promise<GoogleProfile> {
    const ticket = await client.verifyIdToken({ idToken, audience: config.clientId })
    const payload = ticket.getPayload()
    if (!payload?.sub || !payload.email) {
      throw new Error('payload do Google incompleto')
    }

    return {
      providerAccountId: payload.sub,
      email: payload.email,
      name: payload.name ?? payload.email,
    }
  }

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

      return verifyAndBuildProfile(tokens.id_token)
    },

    async verifyIdToken(idToken) {
      return verifyAndBuildProfile(idToken)
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
    verifyIdToken: async () => error(),
  }
}
