import { describe, expect, it } from 'vitest'
import { MAX_DELIVERY_ATTEMPTS, nextRetryDelayMs } from './retryPolicy'

describe('nextRetryDelayMs', () => {
  it.each([
    [1, 60_000],
    [2, 300_000],
    [3, 1_800_000],
    [4, 7_200_000],
  ])('após %s tentativa(s) espera %s ms', (attempts, expected) => {
    expect(nextRetryDelayMs(attempts)).toBe(expected)
  })

  it('esgota na última tentativa', () => {
    expect(nextRetryDelayMs(MAX_DELIVERY_ATTEMPTS)).toBeNull()
    expect(nextRetryDelayMs(MAX_DELIVERY_ATTEMPTS + 3)).toBeNull()
  })
})
