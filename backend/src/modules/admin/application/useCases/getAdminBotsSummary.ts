import type { BotAdmin, BotsSummary } from '../ports/botAdmin'

// Delegação fina (leitura): bots parados, caixa esgotado, liquidez e concentração de float.
export class GetAdminBotsSummaryUseCase {
  constructor(private readonly botAdmin: BotAdmin) {}

  async execute(idleDays?: number): Promise<BotsSummary> {
    return this.botAdmin.summary(idleDays)
  }
}
