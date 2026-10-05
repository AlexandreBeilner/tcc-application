import { describe, expect, it } from 'vitest'
import { classifyLatency, DEGRADED_LATENCY_MS } from './systemHealth'

describe('classifyLatency', () => {
  it('é ok até o limite e degradado acima dele', () => {
    expect(classifyLatency(0)).toBe('ok')
    expect(classifyLatency(DEGRADED_LATENCY_MS)).toBe('ok')
    expect(classifyLatency(DEGRADED_LATENCY_MS + 1)).toBe('degradado')
  })
})
