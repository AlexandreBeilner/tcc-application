export interface GoogleProfile {
  providerAccountId: string
  email: string
  name: string
  // `email_verified` do ID token: o Google garante que o titular controla essa caixa (EM.3.2).
  emailVerified: boolean
}

export interface GoogleIdentityProvider {
  buildAuthUrl(state: string): string
  exchangeCode(code: string): Promise<GoogleProfile>
  verifyIdToken(idToken: string): Promise<GoogleProfile>
}
