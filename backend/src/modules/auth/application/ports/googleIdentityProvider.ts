export interface GoogleProfile {
  providerAccountId: string
  email: string
  name: string
}

export interface GoogleIdentityProvider {
  buildAuthUrl(state: string): string
  exchangeCode(code: string): Promise<GoogleProfile>
}
