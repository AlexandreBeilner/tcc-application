import { describe, expect, it } from 'vitest'
import { InvalidUnsubscribeTokenError } from '../../domain/errors'
import { UnsubscribeByTokenUseCase } from './unsubscribeByToken'
import { createFakeEmailPreferencesRepository } from '../../test/fakes/fakeEmailPreferencesRepository'
import { createFakeUnsubscribeTokens } from '../../test/fakes/fakeUnsubscribe'

describe('UnsubscribeByTokenUseCase', () => {
  const setup = () => {
    const preferences = createFakeEmailPreferencesRepository({
      u1: { social: true, engagement: true },
    })
    return {
      preferences,
      useCase: new UnsubscribeByTokenUseCase(createFakeUnsubscribeTokens(), preferences),
    }
  }

  it('desliga só a categoria do token, sem login', async () => {
    const { preferences, useCase } = setup()

    expect(await useCase.execute({ token: 'u1|social' })).toEqual({ category: 'social' })

    expect(await preferences.get('u1')).toEqual({ social: false, engagement: true })
  })

  it('é idempotente (cliente de e-mail que dispara o POST duas vezes)', async () => {
    const { preferences, useCase } = setup()

    await useCase.execute({ token: 'u1|engagement' })
    await useCase.execute({ token: 'u1|engagement' })

    expect(await preferences.get('u1')).toEqual({ social: true, engagement: false })
  })

  it('token inválido não altera nada', async () => {
    const { preferences, useCase } = setup()

    await expect(useCase.execute({ token: 'lixo' })).rejects.toBeInstanceOf(
      InvalidUnsubscribeTokenError,
    )

    expect(await preferences.get('u1')).toEqual({ social: true, engagement: true })
  })
})
