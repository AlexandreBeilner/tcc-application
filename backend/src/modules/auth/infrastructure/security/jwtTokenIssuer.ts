import jwt from 'jsonwebtoken'
import type { AuthTokenPayload, TokenIssuer } from '../../application/ports/tokenIssuer'

export function createJwtTokenIssuer(secret: string): TokenIssuer {
  return {
    issue(payload: AuthTokenPayload) {
      return jwt.sign(payload, secret, { expiresIn: '7d' })
    },
    verify(token) {
      const decoded = jwt.verify(token, secret)
      if (typeof decoded === 'string' || !('sub' in decoded) || !('role' in decoded)) {
        throw new Error('token com formato inesperado')
      }
      return { sub: String(decoded.sub), role: decoded.role as AuthTokenPayload['role'] }
    },
  }
}
