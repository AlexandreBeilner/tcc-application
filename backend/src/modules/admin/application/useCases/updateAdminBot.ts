import type { AdminBot, BotAdmin, UpdateBotInput } from '../ports/botAdmin'
import type { RecordAdminActionUseCase } from './recordAdminAction'

// Alteração de bot (N.1 e N.15): interruptor, teto, cobertura e personalidade. O motor valida o estado final
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
    if (input.sectors !== undefined) requested.sectors = input.sectors
    if (input.riskClasses !== undefined) requested.risk_classes = input.riskClasses
    if (input.assetClasses !== undefined) requested.asset_classes = input.assetClasses
    if (input.withinScopePct !== undefined) requested.within_scope_pct = input.withinScopePct
    if (input.knowledgeLevel !== undefined) requested.knowledge_level = input.knowledgeLevel
    if (input.maxPositionSizePct !== undefined)
      requested.max_position_size_pct = input.maxPositionSizePct
    if (input.spreadWidthPct !== undefined) requested.spread_width_pct = input.spreadWidthPct

    return this.recordAdminAction.run(
      { adminId, action: 'bot.update', targetType: 'bot', targetId: botId, payload: requested },
      () => this.botAdmin.update(botId, input),
    )
  }
}
