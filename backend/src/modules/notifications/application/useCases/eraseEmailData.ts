import type { EmailOutboxRepository } from '../ports/emailOutboxRepository'
import type { EmailPreferencesRepository } from '../ports/emailPreferencesRepository'

// A confirmação de exclusão é enfileirada antes da anonimização e ainda precisa sair depois dela.
export const KEEP_AFTER_ERASURE = ['account_deleted'] as const

// Exclusão de conta (LGPD): some com as preferências e com as linhas do outbox da pessoa (o
// endereço de entrega e o payload são dado pessoal), menos a confirmação de exclusão que ainda
// está para sair. A supressão por endereço (bounce, reclamação) fica: ela é do endereço, não da
// pessoa, e impede reenviar para um endereço que não entrega.
export class EraseEmailDataUseCase {
  constructor(
    private readonly outbox: EmailOutboxRepository,
    private readonly preferences: EmailPreferencesRepository,
  ) {}

  async execute(input: { userId: string }): Promise<void> {
    await this.preferences.deleteForUser(input.userId)
    await this.outbox.deleteByUser(input.userId, { keepTemplateKeys: KEEP_AFTER_ERASURE })
  }
}
