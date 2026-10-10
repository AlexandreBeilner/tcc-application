import { createHmac, timingSafeEqual } from 'node:crypto'
import type {
  UnsubscribeClaim,
  UnsubscribeLinks,
  UnsubscribeTokens,
} from '../../application/ports/unsubscribeTokens'
import type { OptionalEmailCategory } from '../../domain/emailMessage'

const CATEGORIES: readonly OptionalEmailCategory[] = ['social', 'engagement']
// Entra na mensagem assinada: a mesma chave (ex.: o segredo do JWT, usado como reserva) nunca
// produz uma assinatura que sirva para outro fim.
const PURPOSE = 'email-unsubscribe-v1'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function sign(secret: string, userId: string, category: string): Buffer {
  return createHmac('sha256', secret).update(`${PURPOSE}:${userId}:${category}`).digest()
}

// Token `<userId>.<categoria>.<assinatura>` em base64url (sem `+`, `/` nem `=`: cabe em URL e
// no fragmento sem escape). Sem expiração de propósito: link antigo de e-mail continua valendo.
export function createHmacUnsubscribeTokens(secret: string): UnsubscribeTokens {
  return {
    issue({ userId, category }) {
      return `${userId}.${category}.${sign(secret, userId, category).toString('base64url')}`
    },

    verify(token) {
      const parts = token.split('.')
      if (parts.length !== 3) return null
      const [userId, category, signature] = parts
      if (!UUID.test(userId) || !CATEGORIES.includes(category as OptionalEmailCategory)) return null

      const given = Buffer.from(signature, 'base64url')
      const expected = sign(secret, userId, category)
      if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null
      return { userId, category: category as OptionalEmailCategory }
    },
  }
}

// O link aponta para a API (não para a SPA): `List-Unsubscribe-Post` exige uma URL que aceite
// POST direto. O `GET` dessa mesma URL só redireciona para a página de confirmação do frontend.
export function createUnsubscribeLinks(
  tokens: UnsubscribeTokens,
  apiBaseUrl: string,
): UnsubscribeLinks {
  const base = apiBaseUrl.replace(/\/+$/, '')
  return {
    build(claim: UnsubscribeClaim) {
      return `${base}/email/unsubscribe?token=${tokens.issue(claim)}`
    },
  }
}
