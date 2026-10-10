import type { EmailTokenGenerator } from '../../application/ports/emailTokenGenerator'

// Tokens previsíveis (`token-1`, `token-2`...) e hash trivial, só pra o teste conseguir
// reconstruir o link.
export function createFakeEmailTokenGenerator(): EmailTokenGenerator {
  let counter = 0
  return {
    generate() {
      counter += 1
      const token = `token-${counter}`
      return { token, tokenHash: `hash:${token}` }
    },
    hash(token) {
      return `hash:${token}`
    },
  }
}
