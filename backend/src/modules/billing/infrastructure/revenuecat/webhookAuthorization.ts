import { createHash, timingSafeEqual } from 'node:crypto'

// O RevenueCat manda de volta, em todo POST, o valor de `Authorization` que configuramos no painel.
// A comparação é em tempo constante (hash dos dois lados, mesmo tamanho) pra não vazar o segredo
// por diferença de tempo.
export function createWebhookAuthorizer(expected: string): (header: string | undefined) => boolean {
  const expectedDigest = createHash('sha256').update(expected).digest()
  return (header) => {
    if (!header) return false
    const digest = createHash('sha256').update(header).digest()
    return timingSafeEqual(digest, expectedDigest)
  }
}
