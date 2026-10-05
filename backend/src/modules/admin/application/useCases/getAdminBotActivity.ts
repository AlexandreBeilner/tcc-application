import type { BotActivity, BotAdmin } from '../ports/botAdmin'

// Delegação fina (leitura): desempenho de um bot numa janela de dias simulados. Sem auditoria,
// leitura não muda estado.
export class GetAdminBotActivityUseCase {
  constructor(private readonly botAdmin: BotAdmin) {}

  async execute(botId: string, days?: number): Promise<BotActivity> {
    return this.botAdmin.activity(botId, days)
  }
}
