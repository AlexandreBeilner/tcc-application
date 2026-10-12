import { describe, expect, it } from 'vitest'
import { createCryptoEmailTokenGenerator } from './cryptoEmailTokenGenerator'

describe('cryptoEmailTokenGenerator', () => {
  const generator = createCryptoEmailTokenGenerator()

  it('gera token base64url de 32 bytes e o hash SHA-256 dele', () => {
    const { token, tokenHash } = generator.generate()

    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(tokenHash).toMatch(/^[0-9a-f]{64}$/)
    expect(generator.hash(token)).toBe(tokenHash)
    expect(tokenHash).not.toContain(token)
  })

  it('não repete token', () => {
    expect(generator.generate().token).not.toBe(generator.generate().token)
  })
})
