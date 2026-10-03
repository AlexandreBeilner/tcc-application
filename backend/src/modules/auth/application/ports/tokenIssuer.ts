import type { UserRole } from '../../domain/user'

export interface AuthTokenPayload {
  sub: string
  role: UserRole
  // Segundos desde a época do último momento em que a senha foi conferida
  // (login ou reautenticação, N.22). Ações destrutivas do painel exigem que
  // seja recente. `issue` assume "agora" quando omitido.
  authTime?: number
}

export interface VerifiedAuthToken extends AuthTokenPayload {
  authTime: number
}

export interface TokenIssuer {
  issue(payload: AuthTokenPayload): string
  verify(token: string): VerifiedAuthToken
}
