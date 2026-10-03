import type { AdminBot, BotAdmin, UpdateBotInput } from '../ports/botAdmin'
import type { RecordAdminActionUseCase } from './recordAdminAction'

// Alteração de bot (N.1): interruptor, teto e cobertura. O motor valida o estado final
// inteiro antes de gravar e cancela as ordens do Market Maker nos ativos que ele deixa;
// aqui só a auditoria, com o que foi pedido (só os campos informados).
export class UpdateAdminBotUseCase {
  constructor(
    private readonly botAdmin: BotAdmin,
    private readonly recordAdminAction: RecordAdminActionUseCase,
  ) {}

  async execute(adminId: string, botId: string, input: UpdateBotInput): Promise<AdminBot> {
    const requested: Record<string, unknown> = {}
    if (input.isActive !== undefined) requested.is_active = input.isActive
    if (input.maxCoveredAssets !== undefined) requested.max_covered_assets = input.maxCoveredAssets
    if (input.coveredAssetIds !== undefined) requested.covered_asset_ids = input.coveredAssetIds

    return this.recordAdminAction.run(
      { adminId, action: 'bot.update', targetType: 'bot', targetId: botId, payload: requested },
      () => this.botAdmin.update(botId, input),
    )
  }
}
