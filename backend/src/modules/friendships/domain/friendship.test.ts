import { describe, expect, it } from 'vitest'
import { newRequest } from './friendship'
import { SelfFriendshipError } from './errors'

describe('newRequest', () => {
  it('aceita solicitação entre usuários distintos', () => {
    expect(() => newRequest('u1', 'u2')).not.toThrow()
  })

  it('rejeita auto-amizade', () => {
    expect(() => newRequest('u1', 'u1')).toThrow(SelfFriendshipError)
  })
})
