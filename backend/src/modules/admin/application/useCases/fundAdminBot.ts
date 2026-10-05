import type { AdminBot, BotAdmin, FundBotInput } from '../ports/botAdmin'
import type { RecordAdminActionUseCase } from './recordAdminAction'

// Aporte de caixa e/ou posição num bot (N.15). O motor valida, valoriza a posição pela última
// cotação, respeita o teto de float e grava o aporte como evento imutável; aqui só a auditoria,
// com o que foi pedido (a recusa do motor vira `failed` com o motivo).
export class FundAdminBotUseCase {
  constructor(
    private readonly botAdmin: BotAdmin,
    private readonly recordAdminAction: RecordAdminActionUseCase,
  ) {}

  async execute(adminId: string, botId: string, input: FundBotInput): Promise<AdminBot> {
    const requested: Record<string, unknown> = {}
    if (input.cash !== undefined) requested.cash = input.cash
    if (input.holdings !== undefined) {
      requested.holdings = input.holdings.map((h) => ({
        asset_id: h.assetId,
        quantity: h.quantity,
      }))
    }

    return this.recordAdminAction.run(
      { adminId, action: 'bot.fund', targetType: 'bot', targetId: botId, payload: requested },
      () => this.botAdmin.fund(botId, input),
    )
  }
}
