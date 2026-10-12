import { createHash, randomBytes } from 'node:crypto'
import type { EmailTokenGenerator } from '../../application/ports/emailTokenGenerator'

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex')

// 32 bytes aleatórios em base64url (256 bits: adivinhar é inviável, então SHA-256 sem salt basta
// para o hash que vai ao banco, diferente de senha).
export function createCryptoEmailTokenGenerator(): EmailTokenGenerator {
  return {
    generate() {
      const token = randomBytes(32).toString('base64url')
      return { token, tokenHash: sha256(token) }
    },
    hash: sha256,
  }
}
