import type { OptionalEmailDeps } from '../../application/useCases/enqueueEmail'
import { createFakeEmailPreferencesRepository } from './fakeEmailPreferencesRepository'
import { createFakeRecipientDirectory } from './fakeRecipientDirectory'
import { createFakeUnsubscribeLinks } from './fakeUnsubscribe'

// Dependências do e-mail opcional (EM.6.1) para os testes que só usam segurança/transacional e
// não se importam com elas: ninguém cadastrado, tudo desligado.
export function createFakeOptionalEmailDeps(
  overrides: Partial<OptionalEmailDeps> = {},
): OptionalEmailDeps {
  return {
    preferences: createFakeEmailPreferencesRepository(),
    recipients: createFakeRecipientDirectory(),
    unsubscribeLinks: createFakeUnsubscribeLinks(),
    ...overrides,
  }
}
