import { describe, expect, it } from 'vitest'
import { UpdateEmailPreferencesUseCase } from './updateEmailPreferences'
import { createFakeEmailPreferencesRepository } from '../../test/fakes/fakeEmailPreferencesRepository'

describe('UpdateEmailPreferencesUseCase', () => {
  it('liga só a categoria informada e mantém a outra', async () => {
    const repo = createFakeEmailPreferencesRepository()
    const useCase = new UpdateEmailPreferencesUseCase(repo)

    expect(await useCase.execute({ userId: 'u1', changes: { engagement: true } })).toEqual({
      social: false,
      engagement: true,
    })
    expect(await useCase.execute({ userId: 'u1', changes: { social: true } })).toEqual({
      social: true,
      engagement: true,
    })
  })

  it('desliga e é idempotente', async () => {
    const repo = createFakeEmailPreferencesRepository({ u1: { social: true, engagement: true } })
    const useCase = new UpdateEmailPreferencesUseCase(repo)

    await useCase.execute({ userId: 'u1', changes: { social: false } })
    const again = await useCase.execute({ userId: 'u1', changes: { social: false } })

    expect(again).toEqual({ social: false, engagement: true })
  })
})
