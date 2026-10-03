import jwt from 'jsonwebtoken'
import { describe, expect, it } from 'vitest'
import { createJwtTokenIssuer } from './jwtTokenIssuer'

describe('jwtTokenIssuer', () => {
  it('assina e verifica um token válido', () => {
    const issuer = createJwtTokenIssuer('segredo-de-teste')
    const token = issuer.issue({ sub: 'user-1', role: 'admin' })
    expect(issuer.verify(token)).toMatchObject({ sub: 'user-1', role: 'admin' })
  })

  it('rejeita token adulterado', () => {
    const issuer = createJwtTokenIssuer('segredo-de-teste')
    const token = issuer.issue({ sub: 'user-1', role: 'user' })
    expect(() => issuer.verify(`${token}x`)).toThrow()
  })

  it('rejeita token assinado com outro segredo', () => {
    const issuedWithSecretA = createJwtTokenIssuer('segredo-a')
    const verifiedWithSecretB = createJwtTokenIssuer('segredo-b')
    const token = issuedWithSecretA.issue({ sub: 'user-1', role: 'user' })
    expect(() => verifiedWithSecretB.verify(token)).toThrow()
  })

  it('carrega o authTime informado e assume agora quando omitido', () => {
    const issuer = createJwtTokenIssuer('segredo-de-teste')
    const before = Math.floor(Date.now() / 1000)
    expect(issuer.verify(issuer.issue({ sub: 'u', role: 'user', authTime: 1000 })).authTime).toBe(
      1000,
    )
    expect(issuer.verify(issuer.issue({ sub: 'u', role: 'user' })).authTime).toBeGreaterThanOrEqual(
      before,
    )
  })

  it('token de admin expira em 2h e o de usuário em 7 dias', () => {
    const secret = 'segredo-de-teste'
    const issuer = createJwtTokenIssuer(secret)
    const ttl = (role: 'admin' | 'user') => {
      const decoded = jwt.decode(issuer.issue({ sub: 'u', role })) as { exp: number; iat: number }
      return decoded.exp - decoded.iat
    }
    expect(ttl('admin')).toBe(2 * 3600)
    expect(ttl('user')).toBe(7 * 24 * 3600)
  })
})
