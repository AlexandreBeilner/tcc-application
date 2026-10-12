import { describe, expect, it } from 'vitest'
import { isBlockedBySuppression } from './suppression'

describe('isBlockedBySuppression', () => {
  it.each(['security', 'transactional', 'social', 'engagement'] as const)(
    'bounce barra a categoria %s',
    (category) => {
      expect(isBlockedBySuppression('bounce', category)).toBe(true)
    },
  )

  it.each(['complaint', 'unsubscribe_all'] as const)('%s barra só o opcional', (reason) => {
    expect(isBlockedBySuppression(reason, 'security')).toBe(false)
    expect(isBlockedBySuppression(reason, 'transactional')).toBe(false)
    expect(isBlockedBySuppression(reason, 'social')).toBe(true)
    expect(isBlockedBySuppression(reason, 'engagement')).toBe(true)
  })
})
