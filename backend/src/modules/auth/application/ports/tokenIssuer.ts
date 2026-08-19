import type { UserRole } from '../../domain/user'

export interface AuthTokenPayload {
  sub: string
  role: UserRole
}

export interface TokenIssuer {
  issue(payload: AuthTokenPayload): string
  verify(token: string): AuthTokenPayload
}
