import jwt from 'jsonwebtoken'
import type { AuthTokenPayload, TokenIssuer } from '../../application/ports/tokenIssuer'

// Token de administrador vive pouco (N.22): o painel concentra poder, então
// uma sessão esquecida aberta expira sozinha. Usuário comum segue com 7 dias.
const USER_TOKEN_TTL = '7d'
const ADMIN_TOKEN_TTL = '2h'

export function createJwtTokenIssuer(secret: string): TokenIssuer {
  return {
    issue(payload: AuthTokenPayload) {
      const authTime = payload.authTime ?? Math.floor(Date.now() / 1000)
      return jwt.sign(
        { sub: payload.sub, role: payload.role, authTime, tokenVersion: payload.tokenVersion ?? 0 },
        secret,
        {
          expiresIn: payload.role === 'admin' ? ADMIN_TOKEN_TTL : USER_TOKEN_TTL,
        },
      )
    },
    verify(token) {
      const decoded = jwt.verify(token, secret)
      if (typeof decoded === 'string' || !('sub' in decoded) || !('role' in decoded)) {
        throw new Error('token com formato inesperado')
      }
      // Token emitido antes da N.22 não tem `authTime`: cai no `iat` (momento
      // da emissão, que era sempre um login).
      const authTime = typeof decoded.authTime === 'number' ? decoded.authTime : (decoded.iat ?? 0)
      return {
        sub: String(decoded.sub),
        role: decoded.role as AuthTokenPayload['role'],
        authTime,
        // Token anterior à N.16 não tem o claim: vale 0, a versão inicial.
        tokenVersion: typeof decoded.tokenVersion === 'number' ? decoded.tokenVersion : 0,
      }
    },
  }
}
