import type { EmailPreferences } from '../../domain/emailPreferences'
import { normalizeAddress } from '../../domain/emailMessage'
import type { SuppressionReason } from '../../domain/suppression'
import type { EmailPreferencesRepository } from '../ports/emailPreferencesRepository'
import type { EmailSuppressionRepository } from '../ports/emailSuppressionRepository'
import type { RecipientDirectory } from '../ports/recipientDirectory'

export interface GetEmailPreferencesResult {
  preferences: EmailPreferences
  // Por que o endereço da conta não recebe e-mail, se for o caso (bounce: o endereço não existe;
  // reclamação: a pessoa marcou como spam). A tela de Configurações mostra o aviso.
  suppression: SuppressionReason | null
}

export class GetEmailPreferencesUseCase {
  constructor(
    private readonly preferences: EmailPreferencesRepository,
    private readonly recipients: RecipientDirectory,
    private readonly suppressions: EmailSuppressionRepository,
  ) {}

  async execute(input: { userId: string }): Promise<GetEmailPreferencesResult> {
    const [preferences, recipient] = await Promise.all([
      this.preferences.get(input.userId),
      this.recipients.find(input.userId),
    ])
    const suppression = recipient
      ? await this.suppressions.find(normalizeAddress(recipient.address))
      : null
    return { preferences, suppression }
  }
}
