import { describe, expect, it } from 'vitest'
import { createBcryptPasswordHasher } from './bcryptPasswordHasher'

describe('bcryptPasswordHasher', () => {
  it('gera hash que verifica com a senha original', async () => {
    const hasher = createBcryptPasswordHasher()
    const hash = await hasher.hash('senha-forte-123')
    expect(hash).not.toBe('senha-forte-123')
    await expect(hasher.verify('senha-forte-123', hash)).resolves.toBe(true)
  })

  it('rejeita senha incorreta', async () => {
    const hasher = createBcryptPasswordHasher()
    const hash = await hasher.hash('senha-forte-123')
    await expect(hasher.verify('senha-errada', hash)).resolves.toBe(false)
  })
})
