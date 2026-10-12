import { describe, expect, it } from 'vitest'
import { createInProcessProStatus } from './inProcessProStatus'

class ProRequired extends Error {
  readonly code = 'PRO_REQUIRED'
}

describe('inProcessProStatus', () => {
  it('true quando o guarda de PRO deixa passar', async () => {
    expect(await createInProcessProStatus({ assertPro: async () => undefined }).isPro('u')).toBe(
      true,
    )
  })

  it('false só quando o guarda recusa por falta de plano', async () => {
    const guard = { assertPro: async () => Promise.reject(new ProRequired()) }
    expect(await createInProcessProStatus(guard).isPro('u')).toBe(false)
  })

  it('qualquer outro erro propaga (nunca vira "não é PRO" por engano)', async () => {
    const guard = { assertPro: async () => Promise.reject(new Error('banco fora')) }
    await expect(createInProcessProStatus(guard).isPro('u')).rejects.toThrow('banco fora')
  })
})
