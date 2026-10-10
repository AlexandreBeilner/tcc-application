import type { EmailPreferences } from '../../domain/emailPreferences'
import type { EmailPreferencesRepository } from '../ports/emailPreferencesRepository'

export interface UpdateEmailPreferencesInput {
  userId: string
  changes: Partial<EmailPreferences>
}

// Liga ou desliga categorias opcionais (Configurações e onboarding). Só mexe nas informadas.
export class UpdateEmailPreferencesUseCase {
  constructor(
    private readonly preferences: EmailPreferencesRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(input: UpdateEmailPreferencesInput): Promise<EmailPreferences> {
    return this.preferences.update(input.userId, input.changes, this.now())
  }
}
