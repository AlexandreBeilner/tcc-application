import { describe, expect, it } from 'vitest'
import { createFakeAccountProvisioner } from '../../test/fakes/fakeAccountProvisioner'
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
  it('cria um novo usuário quando não existe conta nem identidade, e abre conta no motor (RNF06)', async () => {
    const userRepository = createFakeUserRepository()
    const accountProvisioner = createFakeAccountProvisioner()
    const useCase = new LoginWithGoogleUseCase(
      userRepository,
      createFakeGoogleIdentityProvider(PROFILE),
      createFakeTokenIssuer(),
      accountProvisioner,
    )

    const result = await useCase.execute({ code: 'auth-code' })

    expect(result.user.email).toBe(PROFILE.email)
    expect(result.user.passwordHash).toBeNull()
    const identity = await userRepository.findIdentity('google', PROFILE.providerAccountId)
    expect(identity?.userId).toBe(result.user.id)
    expect(accountProvisioner.provisionedUserIds).toEqual([result.user.id])
  })

  it('vincula a identidade a uma conta já existente com o mesmo e-mail, sem reabrir conta', async () => {
    const userRepository = createFakeUserRepository()
    const existingUser = await userRepository.createUser({
      name: 'Já cadastrado',
      email: PROFILE.email,
      username: 'jacadastrado',
      passwordHash: 'hashed:senha-forte-123',
    })
    const accountProvisioner = createFakeAccountProvisioner()
    const useCase = new LoginWithGoogleUseCase(
      userRepository,
      createFakeGoogleIdentityProvider(PROFILE),
      createFakeTokenIssuer(),
      accountProvisioner,
    )

    const result = await useCase.execute({ code: 'auth-code' })

    expect(result.user.id).toBe(existingUser.id)
    const identity = await userRepository.findIdentity('google', PROFILE.providerAccountId)
    expect(identity?.userId).toBe(existingUser.id)
    expect(accountProvisioner.provisionedUserIds).toEqual([])
  })

  it('reaproveita o usuário já vinculado à identidade Google, sem duplicar identidade nem reabrir conta', async () => {
    const userRepository = createFakeUserRepository()
    const accountProvisioner = createFakeAccountProvisioner()
    const useCase = new LoginWithGoogleUseCase(
      userRepository,
      createFakeGoogleIdentityProvider(PROFILE),
      createFakeTokenIssuer(),
      accountProvisioner,
    )

    const first = await useCase.execute({ code: 'auth-code' })
    const second = await useCase.execute({ code: 'auth-code' })

    expect(second.user.id).toBe(first.user.id)
    expect(accountProvisioner.provisionedUserIds).toEqual([first.user.id])
  })
})
