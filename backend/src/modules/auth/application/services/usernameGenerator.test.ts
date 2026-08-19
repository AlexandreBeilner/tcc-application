import { describe, expect, it } from 'vitest'
import { createFakeUserRepository } from '../../test/fakes/fakeUserRepository'
import { generateUniqueUsername, usernameFromEmail } from './usernameGenerator'

describe('usernameFromEmail', () => {
  it('extrai e sanitiza a parte local do e-mail', () => {
    expect(usernameFromEmail('Alexandre.Beilner+tcc@example.com')).toBe('alexandrebeilnertcc')
  })

  it('usa um fallback quando a parte local fica vazia após sanitizar', () => {
    expect(usernameFromEmail('@example.com')).toBe('usuario')
  })
})

describe('generateUniqueUsername', () => {
  it('retorna a base quando ela ainda não existe', async () => {
    const userRepository = createFakeUserRepository()
    const username = await generateUniqueUsername(userRepository, 'alexandre')
    expect(username).toBe('alexandre')
  })

  it('gera um candidato diferente quando a base já está em uso', async () => {
    const userRepository = createFakeUserRepository()
    await userRepository.createUser({
      name: 'Alexandre',
      email: 'a@example.com',
      username: 'alexandre',
      passwordHash: null,
    })

    const username = await generateUniqueUsername(userRepository, 'alexandre')
    expect(username).not.toBe('alexandre')
    expect(username.startsWith('alexandre')).toBe(true)
  })
})
