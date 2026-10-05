import type { AdminBotListing, BotAdmin } from '../ports/botAdmin'

// Delegação fina (leitura): bots com cobertura e posições, mais os ativos sem cobertura.
export class ListAdminBotsUseCase {
  constructor(private readonly botAdmin: BotAdmin) {}

  async execute(): Promise<AdminBotListing> {
    return this.botAdmin.list()
  }
}
