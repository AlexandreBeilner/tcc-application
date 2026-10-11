import { describe, expect, it } from 'vitest'
import type { User } from '../../../auth/domain/user'
import { createInProcessVoterProfileReader } from './inProcessVoterProfileReader'

const progression = { execute: async () => ({ level: 4 }) }

describe('inProcessVoterProfileReader', () => {
  it('junta nível e e-mail verificado', async () => {
    const reader = createInProcessVoterProfileReader({
      getProgression: progression,
      userRepository: { findById: async () => ({ emailVerifiedAt: new Date() }) as User },
    })
    expect(await reader.get('u')).toEqual({ level: 4, emailVerified: true })
  })

  it('e-mail sem verificação ou usuário inexistente não é verificado', async () => {
    const unverified = createInProcessVoterProfileReader({
      getProgression: progression,
      userRepository: { findById: async () => ({ emailVerifiedAt: null }) as User },
    })
    expect((await unverified.get('u')).emailVerified).toBe(false)
    const missing = createInProcessVoterProfileReader({
      getProgression: progression,
      userRepository: { findById: async () => undefined },
    })
    expect((await missing.get('u')).emailVerified).toBe(false)
  })
})
