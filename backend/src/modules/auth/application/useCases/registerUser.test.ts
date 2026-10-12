import { describe, expect, it, vi } from 'vitest'
import { EmailAlreadyInUseError, UsernameAlreadyInUseError } from '../../domain/errors'
import { createFakeAccountProvisioner } from '../../test/fakes/fakeAccountProvisioner'
import { createFakePasswordHasher } from '../../test/fakes/fakePasswordHasher'
import { createFakeUserRepository } from '../../test/fakes/fakeUserRepository'
import { RegisterUserUseCase } from './registerUser'

function build(options: { verificationFails?: boolean } = {}) {
  const userRepository = createFakeUserRepository()
  const accountProvisioner = createFakeAccountProvisioner()
  const sentTo: string[] = []
  const useCase = new RegisterUserUseCase(
    userRepository,
    createFakePasswordHasher(),
    accountProvisioner,
    {
      async sendToUser(user) {
        if (options.verificationFails) throw new Error('outbox fora do ar')
        sentTo.push(user.id)
      },
    },
  )
  return { userRepository, accountProvisioner, useCase, sentTo }
}

describe('RegisterUserUseCase', () => {
  it('cria usuário comum não verificado, faz hash da senha e não emite token', async () => {
    const { useCase } = build()

    const result = await useCase.execute({
      name: 'Alexandre',
      email: 'alexandre@example.com',
      username: 'alexandreb',
      password: 'senha-forte-123',
    })

    expect(result.user.role).toBe('user')
    expect(result.user.passwordHash).toBe('hashed:senha-forte-123')
    expect(result.user.emailVerifiedAt).toBeNull()
    expect(result).not.toHaveProperty('token')
  })

  it('dispara o e-mail de verificação para a conta nova', async () => {
    const { useCase, sentTo } = build()

    const result = await useCase.execute({
      name: 'Alexandre',
      email: 'alexandre@example.com',
      username: 'alexandreb',
      password: 'senha-forte-123',
    })

    expect(sentTo).toEqual([result.user.id])
  })

  it('falha ao enfileirar o e-mail nunca derruba o cadastro', async () => {
    const { useCase, userRepository } = build({ verificationFails: true })

    const result = await useCase.execute({
      name: 'Alexandre',
      email: 'alexandre@example.com',
      username: 'alexandreb',
      password: 'senha-forte-123',
    })

    expect(await userRepository.findById(result.user.id)).toBeDefined()
  })

  it('abre conta no motor de simulação com capital inicial padronizado (RNF06)', async () => {
    const { accountProvisioner, useCase } = build()

    const result = await useCase.execute({
      name: 'Alexandre',
      email: 'alexandre@example.com',
      username: 'alexandreb',
      password: 'senha-forte-123',
    })

    expect(accountProvisioner.provisionedUserIds).toEqual([result.user.id])
  })

  it('rejeita e-mail já cadastrado', async () => {
    const { useCase } = build()
    await useCase.execute({
      name: 'A',
      email: 'dup@example.com',
      username: 'a1',
      password: 'senha-forte-123',
    })

    await expect(
      useCase.execute({
        name: 'B',
        email: 'dup@example.com',
        username: 'a2',
        password: 'senha-forte-123',
      }),
    ).rejects.toBeInstanceOf(EmailAlreadyInUseError)
  })

  it('rejeita username já em uso', async () => {
    const { useCase } = build()
    await useCase.execute({
      name: 'A',
      email: 'a@example.com',
      username: 'dup',
      password: 'senha-forte-123',
    })

    await expect(
      useCase.execute({
        name: 'B',
        email: 'b@example.com',
        username: 'dup',
        password: 'senha-forte-123',
      }),
    ).rejects.toBeInstanceOf(UsernameAlreadyInUseError)
  })

  describe('indicação (MO.7.2)', () => {
    const input = {
      name: 'Alexandre',
      email: 'alexandre@example.com',
      username: 'alexandreb',
      password: 'senha-forte-123',
    }

    function buildWithReferral(fails = false) {
      const attributed: Array<[string, unknown]> = []
      const useCase = new RegisterUserUseCase(
        createFakeUserRepository(),
        createFakePasswordHasher(),
        createFakeAccountProvisioner(),
        { async sendToUser() {} },
        {
          async attribute(userId, code) {
            if (fails) throw new Error('indicação fora do ar')
            attributed.push([userId, code])
          },
        },
      )
      return { useCase, attributed }
    }

    it('registra a indicação quando o cadastro traz um código', async () => {
      const { useCase, attributed } = buildWithReferral()
      const { user } = await useCase.execute({ ...input, referralCode: 'ABCD2345' })
      expect(attributed).toEqual([[user.id, 'ABCD2345']])
    })

    it('sem código não chama o módulo de indicação', async () => {
      const { useCase, attributed } = buildWithReferral()
      await useCase.execute(input)
      expect(attributed).toEqual([])
    })

    it('falha na indicação nunca derruba o cadastro', async () => {
      const { useCase } = buildWithReferral(true)
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const { user } = await useCase.execute({ ...input, referralCode: 'ABCD2345' })
      spy.mockRestore()
      expect(user.email).toBe(input.email)
    })
  })
})
