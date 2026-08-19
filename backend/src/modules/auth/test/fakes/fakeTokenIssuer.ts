import type { AuthTokenPayload, TokenIssuer } from '../../application/ports/tokenIssuer'

// Token previsível (não assinado de verdade) — o teste de
// infrastructure/security/jwtTokenIssuer.test.ts é quem valida a assinatura
// JWT em si; aqui só precisamos de um par issue/verify consistente.
export function createFakeTokenIssuer(): TokenIssuer {
  return {
    issue(payload: AuthTokenPayload) {
      return `fake-token:${payload.sub}:${payload.role}`
    },
    verify(token) {
      const [, sub, role] = token.split(':')
      if (!sub || !role) {
        throw new Error('token inválido')
      }
      return { sub, role: role as AuthTokenPayload['role'] }
    },
  }
}
