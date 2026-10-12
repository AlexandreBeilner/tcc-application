import type {
  UnsubscribeClaim,
  UnsubscribeLinks,
  UnsubscribeTokens,
} from '../../application/ports/unsubscribeTokens'

// Token legível `<userId>|<categoria>` (sem assinatura) só para os testes dos casos de uso; a
// assinatura de verdade é testada em `hmacUnsubscribeTokens.test.ts`.
export function createFakeUnsubscribeTokens(): UnsubscribeTokens {
  return {
    issue: ({ userId, category }) => `${userId}|${category}`,
    verify(token) {
      const [userId, category] = token.split('|')
      if (!userId || (category !== 'social' && category !== 'engagement')) return null
      return { userId, category }
    },
  }
}

export function createFakeUnsubscribeLinks(): UnsubscribeLinks {
  const tokens = createFakeUnsubscribeTokens()
  return {
    build: (claim: UnsubscribeClaim) =>
      `https://api.test/email/unsubscribe?token=${tokens.issue(claim)}`,
  }
}
