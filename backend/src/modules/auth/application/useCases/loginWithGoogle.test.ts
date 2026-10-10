import { createFakeAccountMailer } from '../../test/fakes/fakeAccountMailer'
import { describe, expect, it } from 'vitest'
import { AccountSuspendedError, GoogleEmailNotVerifiedError } from '../../domain/errors'
import { createFakeAccountProvisioner } from '../../test/fakes/fakeAccountProvisioner'
import { createFakeGoogleIdentityProvider } from '../../test/fakes/fakeGoogleIdentityProvider'
import { createFakeTokenIssuer } from '../../test/fakes/fakeTokenIssuer'
import { createFakeUserRepository } from '../../test/fakes/fakeUserRepository'
import { LoginWithGoogleUseCase } from './loginWithGoogle'

const PROFILE = {
  providerAccountId: 'google-123',
  email: 'user@example.com',
  name: 'Usuário Google',
  emailVerified: true,
}

describe('LoginWithGoogleUseCase', () => {
  it('cria um novo usuário quando não existe conta nem identidade, e abre conta no motor (RNF06)', async () => {
    const userRepository = createFakeUserRepository()
    const accountProvisioner = createFakeAccountProvisioner()
    const accountMailer = createFakeAccountMailer()
    const useCase = new LoginWithGoogleUseCase(
      userRepository,
      createFakeGoogleIdentityProvider(PROFILE),
      createFakeTokenIssuer(),
      accountProvisioner,
      accountMailer,
    )

    const result = await useCase.execute({ code: 'auth-code' })

    expect(result.user.email).toBe(PROFILE.email)
    expect(result.user.passwordHash).toBeNull()
    // O Google já confirmou o e-mail da conta que ele mesmo criou (EM.3.1).
    expect(result.user.emailVerifiedAt).not.toBeNull()
    const identity = await userRepository.findIdentity('google', PROFILE.providerAccountId)
    expect(identity?.userId).toBe(result.user.id)
    expect(accountProvisioner.provisionedUserIds).toEqual([result.user.id])
    // Boas-vindas (E5): o Google garantiu o e-mail, então a conta já nasce verificada.
    expect(accountMailer.welcomes).toEqual([
      { userId: result.user.id, to: PROFILE.email, name: PROFILE.name },
    ])
  })

  it('não manda boas-vindas a quem só vinculou uma conta que já existia', async () => {
    const userRepository = createFakeUserRepository()
    await userRepository.createUser({
      name: 'Já cadastrado',
      email: PROFILE.email,
      username: 'jacadastrado',
      passwordHash: 'hashed:senha-forte-123',
      emailVerified: true,
    })
    const accountMailer = createFakeAccountMailer()
    const useCase = new LoginWithGoogleUseCase(
      userRepository,
      createFakeGoogleIdentityProvider(PROFILE),
      createFakeTokenIssuer(),
      createFakeAccountProvisioner(),
      accountMailer,
    )

    await useCase.execute({ code: 'auth-code' })

    expect(accountMailer.welcomes).toEqual([])
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
      createFakeAccountMailer(),
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
      createFakeAccountMailer(),
    )

    const first = await useCase.execute({ code: 'auth-code' })
    const second = await useCase.execute({ code: 'auth-code' })

    expect(second.user.id).toBe(first.user.id)
    expect(accountProvisioner.provisionedUserIds).toEqual([first.user.id])
  })

  it('recusa conta suspensa e não vincula identidade nova a ela (N.16)', async () => {
    const userRepository = createFakeUserRepository()
    const suspended = await userRepository.createUser({
      name: 'Suspenso',
      email: PROFILE.email,
      username: 'suspenso',
      passwordHash: null,
    })
    await userRepository.updateUser(suspended.id, { status: 'suspended' })
    const useCase = new LoginWithGoogleUseCase(
      userRepository,
      createFakeGoogleIdentityProvider(PROFILE),
      createFakeTokenIssuer(),
      createFakeAccountProvisioner(),
      createFakeAccountMailer(),
    )

    await expect(useCase.execute({ code: 'auth-code' })).rejects.toBeInstanceOf(
      AccountSuspendedError,
    )
    expect(await userRepository.findIdentity('google', PROFILE.providerAccountId)).toBeUndefined()
  })

  describe('vínculo seguro por e-mail (ponto 043, D3)', () => {
    function build(profile = PROFILE) {
      const userRepository = createFakeUserRepository()
      const useCase = new LoginWithGoogleUseCase(
        userRepository,
        createFakeGoogleIdentityProvider(profile),
        createFakeTokenIssuer(),
        createFakeAccountProvisioner(),
        createFakeAccountMailer(),
      )
      return { userRepository, useCase }
    }

    it('pré-sequestro: conta local não verificada perde a senha e as sessões quando o titular entra pelo Google', async () => {
      const { userRepository, useCase } = build()
      const attacker = await userRepository.createUser({
        name: 'Atacante',
        email: PROFILE.email,
        username: 'atacante',
        passwordHash: 'hashed:senha-do-atacante',
      })

      const result = await useCase.execute({ code: 'auth-code' })

      expect(result.user.id).toBe(attacker.id)
      const after = await userRepository.findById(attacker.id)
      expect(after?.passwordHash).toBeNull()
      expect(after?.emailVerifiedAt).not.toBeNull()
      expect(after?.tokenVersion).toBe(1)
      // O token novo já nasce com a versão nova, senão cairia na hora.
      expect(result.token).toMatch(/:1$/)
      expect(await userRepository.findIdentity('google', PROFILE.providerAccountId)).toBeDefined()
    })

    it('conta local já verificada vincula normal e mantém a senha', async () => {
      const { userRepository, useCase } = build()
      const owner = await userRepository.createUser({
        name: 'Dona',
        email: PROFILE.email,
        username: 'dona',
        passwordHash: 'hashed:minha-senha',
        emailVerified: true,
      })

      await useCase.execute({ code: 'auth-code' })

      const after = await userRepository.findById(owner.id)
      expect(after?.passwordHash).toBe('hashed:minha-senha')
      expect(after?.tokenVersion).toBe(0)
    })

    it('Google sem email_verified não vincula conta existente, nem a modifica', async () => {
      const { userRepository, useCase } = build({ ...PROFILE, emailVerified: false })
      const local = await userRepository.createUser({
        name: 'Local',
        email: PROFILE.email,
        username: 'local',
        passwordHash: 'hashed:senha',
      })

      await expect(useCase.execute({ code: 'auth-code' })).rejects.toBeInstanceOf(
        GoogleEmailNotVerifiedError,
      )
      expect(await userRepository.findIdentity('google', PROFILE.providerAccountId)).toBeUndefined()
      expect((await userRepository.findById(local.id))?.passwordHash).toBe('hashed:senha')
    })

    it('conta nova só nasce verificada se o Google garantiu o e-mail', async () => {
      const verified = await build().useCase.execute({ code: 'auth-code' })
      const unverified = await build({ ...PROFILE, emailVerified: false }).useCase.execute({
        code: 'auth-code',
      })

      expect(verified.user.emailVerifiedAt).not.toBeNull()
      expect(unverified.user.emailVerifiedAt).toBeNull()
    })

    it('identidade já vinculada continua entrando mesmo que o Google reporte e-mail não verificado', async () => {
      const { userRepository, useCase } = build()
      const first = await useCase.execute({ code: 'auth-code' })
      const again = new LoginWithGoogleUseCase(
        userRepository,
        createFakeGoogleIdentityProvider({ ...PROFILE, emailVerified: false }),
        createFakeTokenIssuer(),
        createFakeAccountProvisioner(),
        createFakeAccountMailer(),
      )

      const second = await again.execute({ code: 'auth-code' })

      expect(second.user.id).toBe(first.user.id)
    })
  })
})
