import { InvalidUnsubscribeTokenError } from '../../domain/errors'
import type { OptionalEmailCategory } from '../../domain/emailMessage'
import type { EmailPreferencesRepository } from '../ports/emailPreferencesRepository'
import type { UnsubscribeTokens } from '../ports/unsubscribeTokens'

// Cancelar inscrição pelo link do e-mail, sem login: desliga a categoria do e-mail em questão.
// Idempotente (repetir, ou um cliente de e-mail que dispara o POST duas vezes, deixa o mesmo
// estado). Reversível em Configurações: ligar de novo é um consentimento novo, explícito.
export class UnsubscribeByTokenUseCase {
  constructor(
    private readonly tokens: UnsubscribeTokens,
    private readonly preferences: EmailPreferencesRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(input: { token: string }): Promise<{ category: OptionalEmailCategory }> {
    const claim = this.tokens.verify(input.token)
    if (!claim) throw new InvalidUnsubscribeTokenError()
    await this.preferences.update(claim.userId, { [claim.category]: false }, this.now())
    return { category: claim.category }
  }
}
