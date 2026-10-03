import type { AuthTokenPayload, TokenIssuer } from '../../application/ports/tokenIssuer'

// Token previsível (não assinado de verdade) — o teste de
// infrastructure/security/jwtTokenIssuer.test.ts é quem valida a assinatura
// JWT em si; aqui só precisamos de um par issue/verify consistente. O
// `authTime` (N.22) é o quarto segmento; omitido, vale "agora".
export function createFakeTokenIssuer(): TokenIssuer {
  return {
    issue(payload: AuthTokenPayload) {
      const authTime = payload.authTime ?? Math.floor(Date.now() / 1000)
      return `fake-token:${payload.sub}:${payload.role}:${authTime}`
    },
    verify(token) {
      const [, sub, role, authTime] = token.split(':')
      if (!sub || !role) {
        throw new Error('token inválido')
      }
      return {
        sub,
        role: role as AuthTokenPayload['role'],
        authTime: authTime ? Number(authTime) : 0,
      }
    },
  }
}
