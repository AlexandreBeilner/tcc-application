import { describe, expect, it } from 'vitest'
import { createJwtTokenIssuer } from './jwtTokenIssuer'

describe('jwtTokenIssuer', () => {
  it('assina e verifica um token válido', () => {
    const issuer = createJwtTokenIssuer('segredo-de-teste')
    const token = issuer.issue({ sub: 'user-1', role: 'admin' })
    expect(issuer.verify(token)).toEqual({ sub: 'user-1', role: 'admin' })
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
})
