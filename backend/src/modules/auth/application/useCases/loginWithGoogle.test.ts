import { describe, expect, it } from 'vitest'
import { createFakeGoogleIdentityProvider } from '../../test/fakes/fakeGoogleIdentityProvider'
import { createFakeTokenIssuer } from '../../test/fakes/fakeTokenIssuer'
import { createFakeUserRepository } from '../../test/fakes/fakeUserRepository'
import { LoginWithGoogleUseCase } from './loginWithGoogle'

const PROFILE = {
  providerAccountId: 'google-123',
  email: 'user@example.com',
  name: 'Usuário Google',
}

describe('LoginWithGoogleUseCase', () => {
  it('cria um novo usuário quando não existe conta nem identidade', async () => {
    const userRepository = createFakeUserRepository()
    const useCase = new LoginWithGoogleUseCase(
      userRepository,
      createFakeGoogleIdentityProvider(PROFILE),
      createFakeTokenIssuer(),
    )

    const result = await useCase.execute({ code: 'auth-code' })

    expect(result.user.email).toBe(PROFILE.email)
    expect(result.user.passwordHash).toBeNull()
    const identity = await userRepository.findIdentity('google', PROFILE.providerAccountId)
    expect(identity?.userId).toBe(result.user.id)
  })

  it('vincula a identidade a uma conta já existente com o mesmo e-mail', async () => {
    const userRepository = createFakeUserRepository()
    const existingUser = await userRepository.createUser({
      name: 'Já cadastrado',
      email: PROFILE.email,
      username: 'jacadastrado',
      passwordHash: 'hashed:senha-forte-123',
    })
    const useCase = new LoginWithGoogleUseCase(
      userRepository,
      createFakeGoogleIdentityProvider(PROFILE),
      createFakeTokenIssuer(),
    )

    const result = await useCase.execute({ code: 'auth-code' })

    expect(result.user.id).toBe(existingUser.id)
    const identity = await userRepository.findIdentity('google', PROFILE.providerAccountId)
    expect(identity?.userId).toBe(existingUser.id)
  })

  it('reaproveita o usuário já vinculado à identidade Google, sem duplicar identidade', async () => {
    const userRepository = createFakeUserRepository()
    const useCase = new LoginWithGoogleUseCase(
      userRepository,
      createFakeGoogleIdentityProvider(PROFILE),
      createFakeTokenIssuer(),
    )

    const first = await useCase.execute({ code: 'auth-code' })
    const second = await useCase.execute({ code: 'auth-code' })

    expect(second.user.id).toBe(first.user.id)
  })
})
