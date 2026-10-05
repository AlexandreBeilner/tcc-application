import type { AuthTokenPayload, TokenIssuer } from '../../application/ports/tokenIssuer'

// Token previsível (não assinado de verdade) — o teste de
// infrastructure/security/jwtTokenIssuer.test.ts é quem valida a assinatura
// JWT em si; aqui só precisamos de um par issue/verify consistente. O
// `authTime` (N.22) é o quarto segmento (omitido vale "agora") e o
// `tokenVersion` (N.16) o quinto (omitido vale 0).
export function createFakeTokenIssuer(): TokenIssuer {
  return {
    issue(payload: AuthTokenPayload) {
      const authTime = payload.authTime ?? Math.floor(Date.now() / 1000)
      return `fake-token:${payload.sub}:${payload.role}:${authTime}:${payload.tokenVersion ?? 0}`
    },
    verify(token) {
      const [, sub, role, authTime, tokenVersion] = token.split(':')
      if (!sub || !role) {
        throw new Error('token inválido')
      }
      return {
        sub,
        role: role as AuthTokenPayload['role'],
        authTime: authTime ? Number(authTime) : 0,
        tokenVersion: tokenVersion ? Number(tokenVersion) : 0,
      }
    },
  }
}
