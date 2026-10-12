import { describe, expect, it } from 'vitest'
import { GetEmailPreferencesUseCase } from './getEmailPreferences'
import { createFakeEmailPreferencesRepository } from '../../test/fakes/fakeEmailPreferencesRepository'
import { createFakeEmailSuppressionRepository } from '../../test/fakes/fakeEmailSuppressionRepository'
import { createFakeRecipientDirectory } from '../../test/fakes/fakeRecipientDirectory'

const recipient = { address: 'Ana@Exemplo.com', status: 'active' as const, emailVerified: true }

describe('GetEmailPreferencesUseCase', () => {
  it('conta nova: tudo desligado e endereço sem supressão', async () => {
    const useCase = new GetEmailPreferencesUseCase(
      createFakeEmailPreferencesRepository(),
      createFakeRecipientDirectory({ u1: recipient }),
      createFakeEmailSuppressionRepository(),
    )

    expect(await useCase.execute({ userId: 'u1' })).toEqual({
      preferences: { social: false, engagement: false },
      suppression: null,
    })
  })

  it('devolve o que foi gravado e o motivo da supressão do endereço (em minúsculo)', async () => {
    const useCase = new GetEmailPreferencesUseCase(
      createFakeEmailPreferencesRepository({ u1: { engagement: true } }),
      createFakeRecipientDirectory({ u1: recipient }),
      createFakeEmailSuppressionRepository({ 'ana@exemplo.com': 'bounce' }),
    )

    expect(await useCase.execute({ userId: 'u1' })).toEqual({
      preferences: { social: false, engagement: true },
      suppression: 'bounce',
    })
  })
})
